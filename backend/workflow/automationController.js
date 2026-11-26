const crypto = require("crypto");
const { Form, FormResponse, User } = require("../models");
const { loadWorkbench } = require("../controllers/workbenchAccess");
const { logActivity } = require("../controllers/activity");
const webhook = require("./webhook");
const mailer = require("./mailer");
const automations = require("./automations");

/**
 * The Automations section of the Workflow tab: the webhook, the email to
 * the team and the confirmation to the respondent.
 */

const MAX_RECIPIENTS = 10;
const TEST_COOLDOWN_MS = 10000;
const lastTest = new Map(); // formId:channel → time, so test buttons cannot be hammered

const newSecret = () => crypto.randomBytes(24).toString("hex");
const line = (v, max) => String(v === undefined || v === null ? "" : v).replace(/[\r\n\u0000-\u001F]+/g, " ").trim().slice(0, max);
const para = (v, max) =>
  String(v === undefined || v === null ? "" : v)
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim()
    .slice(0, max);

async function loadOwnForm(req, res) {
  const form = await Form.findByPk(req.params.id);
  const access = form ? await loadWorkbench(form.workbenchId) : null;
  if (!form || !access) {
    res.status(404).json({ message: "Form not found." });
    return null;
  }
  return form;
}

/** Email questions on the form, for the confirmation's "send to" picker. */
function emailQuestions(form) {
  const pages = (form.schema && form.schema.pages) || [];
  return pages.flatMap((p) => (p.fields || []).filter((f) => f && f.type === "email"));
}

async function rowFor(formId) {
  const { FormAutomation } = require("../models");
  const [row] = await FormAutomation.findOrCreate({ where: { formId }, defaults: { formId, webhookSecret: newSecret() } });
  if (!row.webhookSecret) {
    row.webhookSecret = newSecret();
    await row.save();
  }
  return row;
}

const serialise = (row) => ({
  webhookEnabled: row.webhookEnabled,
  webhookUrl: row.webhookUrl || "",
  webhookSecret: row.webhookSecret || "",
  emailEnabled: row.emailEnabled,
  emailTo: row.emailTo || [],
  emailSubject: row.emailSubject || "",
  confirmEnabled: row.confirmEnabled,
  confirmFieldId: row.confirmFieldId || "",
  confirmSubject: row.confirmSubject || "",
  confirmMessage: row.confirmMessage || "",
});

async function logsFor(formId) {
  const { FormAutomationLog } = require("../models");
  const rows = await FormAutomationLog.findAll({ where: { formId }, order: [["id", "DESC"]], limit: 20 });
  return rows.map((r) => ({
    id: r.id,
    channel: r.channel,
    ok: r.ok,
    test: r.test,
    attempts: r.attempts,
    detail: r.detail,
    responseId: r.responseId,
    at: r.createdAt,
  }));
}

async function describe(form, row) {
  return {
    automation: serialise(row),
    mail: { configured: mailer.isConfigured(), from: mailer.fromAddress() },
    logs: await logsFor(form.id),
  };
}

/** GET /api/forms/:id/automations */
exports.get = async (req, res, next) => {
  try {
    const form = await loadOwnForm(req, res);
    if (!form) return undefined;
    return res.json(await describe(form, await rowFor(form.id)));
  } catch (err) {
    return next(err);
  }
};

/** PUT /api/forms/:id/automations   { automation } */
exports.save = async (req, res, next) => {
  try {
    const form = await loadOwnForm(req, res);
    if (!form) return undefined;
    const given = req.body && typeof req.body.automation === "object" && req.body.automation ? req.body.automation : null;
    if (!given) return res.status(400).json({ message: "Nothing was sent." });

    const row = await rowFor(form.id);

    // ---- webhook ----
    const url = line(given.webhookUrl, 500);
    const webhookEnabled = given.webhookEnabled === true;
    if (url || webhookEnabled) {
      const problem = webhook.urlProblem(url);
      if (problem) return res.status(400).json({ message: `Webhook: ${problem}` });
    }

    // ---- email to the team ----
    const list = (Array.isArray(given.emailTo) ? given.emailTo : String(given.emailTo || "").split(/[,;\s]+/))
      .map((e) => line(e, 254).toLowerCase())
      .filter(Boolean);
    const unique = [...new Set(list)];
    const bad = unique.find((e) => !automations.isEmail(e));
    if (bad) return res.status(400).json({ message: `Email: “${bad.slice(0, 60)}” is not an email address.` });
    if (unique.length > MAX_RECIPIENTS) return res.status(400).json({ message: `Email: at most ${MAX_RECIPIENTS} addresses.` });
    const emailEnabled = given.emailEnabled === true;
    if (emailEnabled && !unique.length) return res.status(400).json({ message: "Email: add at least one address to send to." });

    // ---- confirmation to the respondent ----
    const confirmEnabled = given.confirmEnabled === true;
    const fieldId = line(given.confirmFieldId, 64);
    const known = emailQuestions(form).some((f) => f.id === fieldId);
    if (confirmEnabled && !known) {
      return res.status(400).json({ message: "Confirmation: choose the email question whose answer receives it." });
    }

    Object.assign(row, {
      webhookEnabled,
      webhookUrl: url || null,
      emailEnabled,
      emailTo: unique,
      emailSubject: line(given.emailSubject, 200) || null,
      confirmEnabled,
      confirmFieldId: known ? fieldId : null,
      confirmSubject: line(given.confirmSubject, 200) || null,
      confirmMessage: para(given.confirmMessage, 2000) || null,
    });
    const changed = row.changed();
    row.changed("emailTo", true);
    await row.save();

    if (changed && changed.length) {
      await logActivity(req, {
        entityType: "form",
        entityId: form.id,
        entityName: form.name,
        action: "edited",
        detail: "Workflow: automations changed",
      });
    }
    return res.json(await describe(form, row));
  } catch (err) {
    return next(err);
  }
};

/** POST /api/forms/:id/automations/secret — a new signing secret. */
exports.newSecret = async (req, res, next) => {
  try {
    const form = await loadOwnForm(req, res);
    if (!form) return undefined;
    const row = await rowFor(form.id);
    row.webhookSecret = newSecret();
    await row.save();
    await logActivity(req, {
      entityType: "form",
      entityId: form.id,
      entityName: form.name,
      action: "edited",
      detail: "Workflow: webhook secret replaced",
    });
    return res.json(await describe(form, row));
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/forms/:id/automations/test   { channel }
 * Sends one test using the newest finished response, or made-up answers.
 * The confirmation test goes to the signed-in user, never to a respondent.
 */
exports.test = async (req, res, next) => {
  try {
    const form = await loadOwnForm(req, res);
    if (!form) return undefined;
    const channel = ["webhook", "email", "confirm"].includes(req.body && req.body.channel) ? req.body.channel : null;
    if (!channel) return res.status(400).json({ message: "Unknown test." });

    const key = `${form.id}:${channel}`;
    const now = Date.now();
    if (now - (lastTest.get(key) || 0) < TEST_COOLDOWN_MS) {
      return res.status(429).json({ message: "Wait a few seconds before testing again." });
    }
    lastTest.set(key, now);

    const row = await rowFor(form.id);
    const latest = await FormResponse.findOne({ where: { formId: form.id, completed: true }, order: [["id", "DESC"]] });
    const sample = latest || { id: null, createdAt: new Date(), completed: true, answers: {} };

    let result;
    if (channel === "webhook") {
      if (!row.webhookUrl) return res.status(400).json({ message: "Save a webhook address first." });
      result = await automations.runWebhook(form, sample, row, { test: true });
    } else if (channel === "email") {
      if (!(row.emailTo || []).length) return res.status(400).json({ message: "Save at least one address first." });
      result = await automations.runTeamEmail(form, sample, row, { test: true });
    } else {
      const me = await User.findByPk(req.user.id, { attributes: ["email"] });
      result = await automations.runConfirm(form, sample, row, { test: true, to: me && me.email });
    }

    const out = await describe(form, row);
    return res.status(result.ok ? 200 : 502).json({
      ...out,
      message: result.ok ? "Test sent." : result.error || "The test did not go through.",
    });
  } catch (err) {
    return next(err);
  }
};