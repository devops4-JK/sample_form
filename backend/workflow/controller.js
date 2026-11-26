const { Form } = require("../models");
const { loadWorkbench } = require("../controllers/workbenchAccess");
const { logActivity } = require("../controllers/activity");
const { cleanWorkflow } = require("./clean");
const { workflowFor, saveWorkflow } = require("./store");

/**
 * The Workflow tab in the form editor: read and save a form's logic jumps.
 */

async function loadOwnForm(req, res) {
  const form = await Form.findByPk(req.params.id);
  const access = form ? await loadWorkbench(form.workbenchId) : null;
  if (!form || !access) {
    res.status(404).json({ message: "Form not found." });
    return null;
  }
  return form;
}

/** GET /api/forms/:id/workflow */
exports.get = async (req, res, next) => {
  try {
    const form = await loadOwnForm(req, res);
    if (!form) return undefined;
    return res.json({ workflow: await workflowFor(form) });
  } catch (err) {
    return next(err);
  }
};

/** PUT /api/forms/:id/workflow   { workflow } */
exports.save = async (req, res, next) => {
  try {
    const form = await loadOwnForm(req, res);
    if (!form) return undefined;
    if (!req.body || typeof req.body.workflow !== "object" || req.body.workflow === null) {
      return res.status(400).json({ message: "No workflow was sent." });
    }

    const before = await workflowFor(form);
    const workflow = cleanWorkflow(form.schema, req.body.workflow);
    await saveWorkflow(form.id, workflow);

    // One line in the history naming the parts that changed.
    const PARTS = { pages: "logic", hidden: "hidden fields", variables: "variables", scoring: "scoring", calcs: "calculations", tags: "tags", outcomes: "endings" };
    const changed = Object.keys(PARTS).filter((k) => JSON.stringify(before[k]) !== JSON.stringify(workflow[k]));
    if (changed.length) {
      await logActivity(req, {
        entityType: "form",
        entityId: form.id,
        entityName: form.name,
        action: "edited",
        detail: `Workflow: ${changed.map((k) => PARTS[k]).join(", ")} changed`,
      });
    }

    return res.json({ workflow });
  } catch (err) {
    return next(err);
  }
};