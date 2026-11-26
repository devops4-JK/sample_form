const { exportColumns, cellValue } = require("../controllers/formSchema");
const { recall } = require("./engine");
const webhook = require("./webhook");
const mailer = require("./mailer");

/**
 * What happens after a form is finished: the webhook, the email to the
 * team and the confirmation to the respondent. Runs after the answers are
 * stored and never holds up the respondent; every send is written to the
 * delivery log the Automations panel shows.
 */

const KEEP_LOGS = 50;

const models = () => require("../models");

const escapeHtml = (s) =>
  String(s === undefined || s === null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]{1,64}@[A-Za-z0-9.-]{1,253}\.[A-Za-z]{2,}$/;
const isEmail = (s) => typeof s === "string" && s.length <= 254 && EMAIL_RE.test(s.trim());

/** The answers as question → value pairs, the same columns the export uses. */
function readable(form, answers) {
  return exportColumns(form.schema).map((c) => ({ question: c.header, value: cellValue(c.read(answers)) }));
}

/** What the webhook receives. */
function payloadFor(form, response, { test = false } = {}) {
  const all = (response && response.answers) || {};
  const { _meta: meta, ...answers } = all;
  const m = meta || {};
  return {
    event: "form.submitted",
    test,
    form: { id: form.id, name: form.name, publicId: form.publicId },
    response: {
      id: response ? response.id : null,
      submittedAt: response && response.createdAt ? new Date(response.createdAt).toISOString() : new Date().toISOString(),
      completed: response ? response.completed !== false : true,
    },
    answers: readable(form, answers),
    raw: answers,
    hidden: m.hidden || {},
    variables: m.vars || {},
    score: m.score === undefined ? null : m.score,
    tags: m.tags || [],
    ending: m.outcome ? m.outcome.title || m.outcome.id : null,
  };
}

/** Names a subject or message can use: {{form}}, link values, variables, {{score}}. */
function namesFor(form, response) {
  const m = (response && response.answers && response.answers._meta) || {};
  return { hidden: m.hidden || {}, vars: { ...(m.vars || {}), form: form.name } };
}

function teamEmail(form, response, subjectTemplate) {
  const p = payloadFor(form, response);
  const { hidden, vars } = namesFor(form, response);
  const subject = recall(subjectTemplate || "New response: {{form}}", hidden, vars) || `New response: ${form.name}`;
  const rows = [
    ...p.answers,
    ...(p.score !== null ? [{ question: "Score", value: p.score }] : []),
    ...(p.tags.length ? [{ question: "Tags", value: p.tags.join(", ") }] : []),
    ...(p.ending ? [{ question: "Ending", value: p.ending }] : []),
    ...Object.entries(p.hidden).map(([k, v]) => ({ question: `Link: ${k}`, value: v })),
  ];
  const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#111">
<p style="margin:0 0 12px">A new response came in on <b>${escapeHtml(form.name)}</b>.</p>
<table cellpadding="8" cellspacing="0" style="border-collapse:collapse;border:1px solid #e4e4e4;max-width:640px">
${rows
  .map(
    (r) =>
      `<tr><td style="border:1px solid #e4e4e4;background:#fafafa;font-weight:bold;vertical-align:top">${escapeHtml(r.question)}</td><td style="border:1px solid #e4e4e4">${escapeHtml(r.value) || "&mdash;"}</td></tr>`
  )
  .join("\n")}
</table>
<p style="margin:12px 0 0;color:#6b6b6b;font-size:12px">Submitted ${escapeHtml(p.response.submittedAt)} · response #${escapeHtml(p.response.id ?? "test")}</p>
</div>`;
  const text = rows.map((r) => `${r.question}: ${r.value}`).join("\n");
  return { subject, html, text };
}

function confirmEmail(form, response, subjectTemplate, messageTemplate) {
  const { hidden, vars } = namesFor(form, response);
  const subject = recall(subjectTemplate || "Thanks — we got your answers", hidden, vars);
  const message = recall(messageTemplate || "Thanks for filling in {{form}}. Your answers are in.", hidden, vars);
  const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#111;line-height:1.5">${escapeHtml(message).replace(/\n/g, "<br>")}</div>`;
  return { subject, html, text: message };
}

/** Writes one line to the delivery log and trims old lines. */
async function log(formId, entry) {
  try {
    const { FormAutomationLog } = models();
    await FormAutomationLog.create({ formId, ...entry, detail: String(entry.detail || "").slice(0, 300) });
    const old = await FormAutomationLog.findAll({
      where: { formId },
      order: [["id", "DESC"]],
      offset: KEEP_LOGS,
      limit: 1,
      attributes: ["id"],
    });
    if (old.length) {
      const { Op } = require("sequelize");
      await FormAutomationLog.destroy({ where: { formId, id: { [Op.lte]: old[0].id } } });
    }
  } catch (err) {
    console.warn("Could not write the automation log:", err.message);
  }
}

async function runWebhook(form, response, auto, { test = false } = {}) {
  const result = await webhook.deliver(auto.webhookUrl, payloadFor(form, response, { test }), auto.webhookSecret, { retries: !test });
  await log(form.id, {
    responseId: response && response.id ? response.id : null,
    channel: "webhook",
    ok: result.ok,
    test,
    attempts: result.attempts || 1,
    detail: result.ok ? `Delivered (${result.status})` : result.error,
  });
  return result;
}

async function runTeamEmail(form, response, auto, { test = false } = {}) {
  const to = (auto.emailTo || []).filter(isEmail);
  if (!to.length) return { ok: false, error: "No addresses to send to." };
  const mail = teamEmail(form, response, auto.emailSubject);
  const result = await mailer.send({ to: to.join(", "), ...mail });
  await log(form.id, {
    responseId: response && response.id ? response.id : null,
    channel: "email",
    ok: result.ok,
    test,
    detail: result.ok ? `Sent to ${to.length} address${to.length === 1 ? "" : "es"}` : result.error,
  });
  return result;
}

async function runConfirm(form, response, auto, { test = false, to = null } = {}) {
  const address = to || (response && response.answers ? response.answers[auto.confirmFieldId] : "");
  if (!isEmail(address)) {
    if (!test) await log(form.id, { responseId: response.id, channel: "confirm", ok: false, detail: "No valid email address in the answer" });
    return { ok: false, error: "No valid email address." };
  }
  const mail = confirmEmail(form, response, auto.confirmSubject, auto.confirmMessage);
  const result = await mailer.send({ to: address.trim(), ...mail });
  await log(form.id, {
    responseId: response && response.id ? response.id : null,
    channel: "confirm",
    ok: result.ok,
    test,
    // The respondent's address is not written to the log.
    detail: result.ok ? "Confirmation sent" : result.error,
  });
  return result;
}

/** After a finished submission. Fire and forget; never throws. */
function dispatch(form, response) {
  (async () => {
    const { FormAutomation } = models();
    const auto = await FormAutomation.findOne({ where: { formId: form.id } });
    if (!auto) return;
    const jobs = [];
    if (auto.webhookEnabled && auto.webhookUrl) jobs.push(runWebhook(form, response, auto));
    if (auto.emailEnabled) jobs.push(runTeamEmail(form, response, auto));
    if (auto.confirmEnabled && auto.confirmFieldId) jobs.push(runConfirm(form, response, auto));
    await Promise.all(jobs);
  })().catch((err) => console.warn("Automation failed:", err.message));
}

module.exports = { dispatch, payloadFor, runWebhook, runTeamEmail, runConfirm, isEmail, escapeHtml };