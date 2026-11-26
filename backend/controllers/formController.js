const {
  Form,
  FormResponse,
  FormQuestion,
  FormLiveTheme,
  FormTheme,
  Theme,
  User,
  Workbench,
  sequelize,
} = require("../models");
const { syncQuestions } = require("./formSchema");
const { FORM_LIMIT, loadWorkbench } = require("./workbenchAccess");
const { logActivity } = require("./activity");
const { sortRows } = require("./sorting");
const { publishLive } = require("./themeController");
const gate = require("../validation/gate");
const { sanitiseAnswers, sanitiseSchema } = require("./sanitise");
const sheets = require("../sheets/sync");
const { workflowFor } = require("../workflow/store");
const { publicWorkflow } = require("../workflow/clean");
const { recall } = require("../workflow/engine");
const automations = require("../workflow/automations");

const STATUSES = ["draft", "published", "closed"];

const SORTS = {
  created: [["createdAt", "DESC"]],
  updated: [["updatedAt", "DESC"]],
};

// Every new form starts in the CompanyStore logo red. A form's colour can
// still be changed afterwards from the Design dialog.
const DEFAULT_COLOUR = "#e01e23";

function serialise(form) {
  return {
    id: form.id,
    workbenchId: form.workbenchId,
    name: form.name,
    publicId: form.publicId,
    colour: form.colour,
    status: form.status,
    responses: form.responsesCount,
    completed: form.completedCount,
    integrations: form.integrations,
    created: form.createdAt,
    updated: form.updatedAt,
    createdBy: form.owner ? { id: form.owner.id, name: form.owner.name, email: form.owner.email } : null,
  };
}

/**
 * The look a form is being built with — what the builder shows. Changing
 * it never reaches the public link on its own.
 */
async function themeFor(formId) {
  const link = await FormTheme.findOne({
    where: { formId },
    include: [{ model: Theme, as: "theme" }],
  });
  if (!link || !link.theme) return null;
  return { id: link.theme.id, name: link.theme.name, config: link.theme.config || {} };
}

/** The look the published link serves: the copy taken when it was published. */
async function liveThemeFor(formId) {
  const live = await FormLiveTheme.findOne({ where: { formId } });
  if (!live) return null;
  return { id: live.themeId, name: live.name, config: live.config || {} };
}

/** Forms are shared, so the list is simply every form. */
const withOwner = {
  include: [{ model: User, as: "owner", attributes: ["id", "name", "email"] }],
};

/** Refuses when the target workbench already holds FORM_LIMIT forms. */
async function assertRoom(workbenchId, name) {
  const count = await Form.count({ where: { workbenchId } });
  if (count >= FORM_LIMIT) {
    const err = new Error(
      `“${name}” already holds ${FORM_LIMIT} forms. Delete one or pick another workbench.`
    );
    err.status = 409;
    err.expose = true;
    throw err;
  }
}

/**
 * GET /api/forms
 *   ?workbenchId=3  one workbench
 *   (omitted)       every form the user can see
 *   ?sort=created|updated
 */
exports.list = async (req, res, next) => {
  try {
    const order = SORTS[req.query.sort] || SORTS.created;

    const where = {};
    if (req.query.workbenchId) {
      const access = await loadWorkbench(req.query.workbenchId);
      if (!access) return res.status(404).json({ message: "Workbench not found." });
      where.workbenchId = access.workbench.id;
    }

    /* The schema holds the questions — pictures included — and the list
       does not show any of it. Leaving it out keeps the rows small, and
       sorting here rather than in SQL keeps them out of MySQL's sort
       buffer entirely. */
    const forms = await Form.findAll({
      where,
      attributes: { exclude: ["schema"] },
      ...withOwner,
    });
    return res.json({ forms: sortRows(forms, order).map(serialise) });
  } catch (err) {
    return next(err);
  }
};

exports.getOne = async (req, res, next) => {
  try {
    const form = await Form.findByPk(req.params.id, withOwner);
    if (!form) return res.status(404).json({ message: "Form not found." });

    const access = await loadWorkbench(form.workbenchId);
    if (!access) return res.status(404).json({ message: "Form not found." });

    // The builder needs the saved pages and questions. Without the schema
    // here, every reload would open a blank form. The theme rides along so
    // the Design panel opens on the look this form already wears.
    const [theme, live] = await Promise.all([themeFor(form.id), liveThemeFor(form.id)]);
    const liveIsBehind =
      JSON.stringify(theme ? theme.config : null) !== JSON.stringify(live ? live.config : null);

    return res.json({
      form: { ...serialise(form), schema: form.schema, theme, liveTheme: live, liveIsBehind },
    });
  } catch (err) {
    return next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    const { workbenchId } = req.body;
    const name = (req.body.name || "Untitled form").trim();

    const access = await loadWorkbench(workbenchId);
    if (!access) return res.status(404).json({ message: "Workbench not found." });

    await assertRoom(access.workbench.id, access.workbench.name);

    const form = await Form.create({
      workbenchId: access.workbench.id,
      ownerId: req.user.id,
      name,
      colour: DEFAULT_COLOUR,
      schema: req.body.schema || null,
    });

    await logActivity(req, {
      entityType: "form",
      entityId: form.id,
      entityName: form.name,
      action: "created",
      detail: `In ${access.workbench.name}`,
    });

    return res.status(201).json({ form: serialise(form) });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    if (err.name === "SequelizeValidationError") {
      return res.status(400).json({ message: err.errors[0].message });
    }
    return next(err);
  }
};

/** Rename, and anything else the builder edits later. */
exports.update = async (req, res, next) => {
  try {
    const form = await Form.findByPk(req.params.id);
    if (!form) return res.status(404).json({ message: "Form not found." });

    const access = await loadWorkbench(form.workbenchId);
    if (!access) return res.status(404).json({ message: "Form not found." });

    const before = { name: form.name, status: form.status };

    if (req.body.name !== undefined) {
      const name = String(req.body.name).trim().slice(0, 160);
      if (!name) return res.status(400).json({ message: "Give the form a name." });
      form.name = name;
    }
    if (req.body.status !== undefined) {
      if (!STATUSES.includes(req.body.status)) {
        return res.status(400).json({ message: "That is not a status a form can have." });
      }
      form.status = req.body.status;
    }
    // The Design dialog sends a colour; only accept a plain hex value.
    if (req.body.colour !== undefined && /^#[0-9a-f]{6}$/i.test(req.body.colour)) {
      form.colour = req.body.colour;
    }
    // Checked on the way in: shape, size, and that every picture and link
    // is a real picture or web address. Throws a 400 the builder shows.
    if (req.body.schema !== undefined) form.schema = sanitiseSchema(req.body.schema);
    if (req.body.integrations !== undefined) form.integrations = Boolean(req.body.integrations);

    // Save the form and rebuild its rows in form_questions together, so the
    // two never disagree. A rename rewrites formName on every row too.
    const touchesQuestions = req.body.schema !== undefined || req.body.name !== undefined;
    await sequelize.transaction(async (t) => {
      await form.save({ transaction: t });
      if (touchesQuestions) await syncQuestions(FormQuestion, form, t);
    });

    // One line in the history for whichever part changed.
    if (req.body.name !== undefined && before.name !== form.name) {
      await logActivity(req, {
        entityType: "form",
        entityId: form.id,
        entityName: form.name,
        action: "renamed",
        detail: `Renamed from "${before.name}"`,
      });
    } else if (req.body.status !== undefined && before.status !== form.status) {
      // Publishing is what puts the design on the live link: the look the
      // form is being built with is copied across at this moment, and not
      // before.
      if (form.status === "published") await publishLive(form.id);

      await logActivity(req, {
        entityType: "form",
        entityId: form.id,
        entityName: form.name,
        action: form.status === "published" ? "published" : "unpublished",
      });
    } else if (req.body.schema !== undefined) {
      const questions = await FormQuestion.count({ where: { formId: form.id } });
      await logActivity(req, {
        entityType: "form",
        entityId: form.id,
        entityName: form.name,
        action: "edited",
        detail: `${questions} item${questions === 1 ? "" : "s"} on the form`,
      });
    } else if (req.body.colour !== undefined) {
      await logActivity(req, {
        entityType: "form",
        entityId: form.id,
        entityName: form.name,
        action: "edited",
        detail: "Changed the form colour",
      });
    }

    // New or renamed questions change the columns of a linked sheet.
    if (touchesQuestions) sheets.schedule(form.id);

    return res.json({ form: serialise(form) });
  } catch (err) {
    if (err.name === "SequelizeValidationError") {
      return res.status(400).json({ message: err.errors[0].message });
    }
    return next(err);
  }
};

/** Move to another workbench. Both ends are access-checked and the cap applies. */
exports.move = async (req, res, next) => {
  try {
    const form = await Form.findByPk(req.params.id);
    if (!form) return res.status(404).json({ message: "Form not found." });

    const from = await loadWorkbench(form.workbenchId);
    if (!from) return res.status(404).json({ message: "Form not found." });

    const to = await loadWorkbench(req.body.workbenchId);
    if (!to) return res.status(404).json({ message: "Target workbench not found." });

    if (to.workbench.id === form.workbenchId) {
      return res.json({ form: serialise(form) });
    }

    await assertRoom(to.workbench.id, to.workbench.name);

    form.workbenchId = to.workbench.id;
    await form.save();

    await logActivity(req, {
      entityType: "form",
      entityId: form.id,
      entityName: form.name,
      action: "moved",
      detail: `From ${from.workbench.name} to ${to.workbench.name}`,
    });

    return res.json({ form: serialise(form) });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    return next(err);
  }
};

exports.remove = async (req, res, next) => {
  try {
    const form = await Form.findByPk(req.params.id);
    if (!form) return res.status(404).json({ message: "Form not found." });

    const access = await loadWorkbench(form.workbenchId);
    if (!access) return res.status(404).json({ message: "Form not found." });

    const name = form.name;
    await form.destroy();

    await logActivity(req, {
      entityType: "form",
      entityId: Number(req.params.id),
      entityName: name,
      action: "deleted",
      detail: `From ${access.workbench.name}`,
    });

    return res.json({ message: "Form deleted.", id: Number(req.params.id) });
  } catch (err) {
    return next(err);
  }
};

/**
 * Every element of a form, one row each, with the form's name.
 * Forms saved before form_questions existed are filled in on first read.
 */
exports.questions = async (req, res, next) => {
  try {
    const form = await Form.findByPk(req.params.id);
    if (!form) return res.status(404).json({ message: "Form not found." });

    const access = await loadWorkbench(form.workbenchId);
    if (!access) return res.status(404).json({ message: "Form not found." });

    const BY_POSITION = [["pageNumber", "ASC"], ["position", "ASC"]];

    let rows = await FormQuestion.findAll({ where: { formId: form.id } });

    if (!rows.length && form.schema) {
      await sequelize.transaction((t) => syncQuestions(FormQuestion, form, t));
      rows = await FormQuestion.findAll({ where: { formId: form.id } });
    }

    return res.json({
      formId: form.id,
      formName: form.name,
      questions: sortRows(rows, BY_POSITION),
    });
  } catch (err) {
    return next(err);
  }
};

/** Answers for one form, newest first. Members only. */
exports.responses = async (req, res, next) => {
  try {
    const form = await Form.findByPk(req.params.id);
    if (!form) return res.status(404).json({ message: "Form not found." });

    const access = await loadWorkbench(form.workbenchId);
    if (!access) return res.status(404).json({ message: "Form not found." });

    const all = await FormResponse.findAll({ where: { formId: form.id } });
    const rows = sortRows(all, [["createdAt", "DESC"]]).slice(0, 200);

    return res.json({
      responses: rows.map((r) => ({
        id: r.id,
        answers: r.answers,
        completed: r.completed,
        submittedAt: r.createdAt,
      })),
    });
  } catch (err) {
    return next(err);
  }
};

/** Takes a submission from the public link. No token needed. */
exports.submitPublic = async (req, res, next) => {
  try {
    const form = await Form.findOne({
      where: { publicId: req.params.publicId, status: "published" },
    });
    if (!form) return res.status(404).json({ message: "This form is not accepting answers." });

    const completed = req.body.completed !== false;

    /* Never stored as sent. Only answers to questions that are on the form
       are kept, cut to a sensible size, and a finished form must answer
       everything marked Required — the page checks that too, but a page
       can be bypassed. Done before the ticket is claimed, so a rejected
       submission does not use the ticket up. */
    const workflow = await workflowFor(form);
    const checked = sanitiseAnswers(form.schema, req.body.answers, {
      completed,
      workflow,
      hidden: req.body.hidden,
    });
    if (checked.error) return res.status(400).json({ message: checked.error });
    const { meta, outcome } = checked;
    // The run's results travel with the answers under one reserved key.
    const answers = meta ? { ...checked.answers, _meta: meta } : checked.answers;

    /* The ticket the gate handed out when this address signed in. Checked
       before anything is stored, so a refused submission leaves no trace.
       A form with no validation has no ticket and no gate to pass. */
    const pass = await gate.claim(form.id, req.body.ticket);
    if (!pass.ok) {
      return res.status(403).json({ message: pass.message, reason: pass.reason });
    }

    const saved = await FormResponse.create({ formId: form.id, answers, completed });

    // Webhook and email, after the answers are safely stored. Never awaited:
    // a slow receiver must not hold up the respondent.
    if (completed) automations.dispatch(form, saved);

    // Only a finished form closes the address off.
    await gate.markDone(pass.entry, saved.id, completed);

    // Counters rather than a join, so the list page stays cheap.
    form.responsesCount += 1;
    if (completed) form.completedCount += 1;
    await form.save();

    // A linked Google Sheet gets the new row and the "Yes" within a second.
    sheets.schedule(form.id);

    return res.status(201).json({
      message: "Thanks, your answers are in.",
      ending: endingFor(outcome, meta),
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * The ending to show after a submission, chosen by the server's own run.
 * {{names}} in the title and message are filled with plain text; in the
 * redirect address they are URL-encoded, and the result must still be an
 * http(s) address.
 */
function endingFor(outcome, meta) {
  if (!outcome || !meta) return null;
  const vars = meta.vars || {};
  const hidden = meta.hidden || {};
  let redirect = "";
  if (outcome.redirect) {
    const enc = (v) => encodeURIComponent(String(v));
    const filled = recall(
      outcome.redirect,
      Object.fromEntries(Object.entries(hidden).map(([k, v]) => [k, enc(v)])),
      Object.fromEntries(Object.entries(vars).map(([k, v]) => [k, enc(v)]))
    );
    try {
      const u = new URL(filled);
      if (u.protocol === "https:" || u.protocol === "http:") redirect = u.toString();
    } catch (_) {
      redirect = "";
    }
  }
  return {
    title: recall(outcome.title || "", hidden, vars),
    message: recall(outcome.message || "", hidden, vars),
    redirect,
  };
}

/** Public lookup behind the shared link. No token needed. */
exports.getPublic = async (req, res, next) => {
  try {
    const form = await Form.findOne({
      where: { publicId: req.params.publicId, status: "published" },
      include: [{ model: Workbench, as: "workbench", attributes: ["name"] }],
    });
    if (!form) return res.status(404).json({ message: "This form is not available." });

    // The public link serves the copy taken at publish time, never the
    // theme as it is being edited.
    const theme = await liveThemeFor(form.id);

    /* Only which of the three ways the form works, never the list itself:
       the page needs to know whether to ask for an address, and nothing
       more. Who is on the list stays on the server. */
    const settings = await gate.peek(form.id);

    // The logic jumps, scoring and endings, so the page can follow them.
    // The server walks them again on submit, so changing them in the
    // browser gains nothing. Tags stay on the server.
    const workflow = publicWorkflow(await workflowFor(form));

    return res.json({
      form: {
        name: form.name,
        publicId: form.publicId,
        schema: form.schema,
        theme,
        validation: { mode: settings.mode },
        workflow,
      },
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/forms/public/:publicId/sign-in
 *
 * The gate on a validated form. Answers either with a ticket that opens
 * the form, or with the reason the address was turned away, which is what
 * the error page reads.
 */
exports.signInPublic = async (req, res, next) => {
  try {
    const form = await Form.findOne({
      where: { publicId: req.params.publicId, status: "published" },
    });
    if (!form) return res.status(404).json({ message: "This form is not available." });

    const result = await gate.signIn(form.id, req.body.email);

    if (!result.ok) {
      // 403, not 400: the address was understood and refused.
      const code = result.reason === "not_an_email" ? 400 : 403;
      return res.status(code).json({ message: result.message, reason: result.reason });
    }

    // Opening the form changes that address's status in a linked sheet.
    sheets.schedule(form.id);

    return res.json({ ticket: result.ticket, email: result.email });
  } catch (err) {
    return next(err);
  }
};