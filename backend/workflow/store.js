const { FormWorkflow } = require("../models");
const { cleanWorkflow } = require("./clean");

/**
 * Reading and writing the stored workflow. Always read through cleanWorkflow
 * against the form as it is now, so a rule pointing at a page or question
 * that has since been deleted simply drops out.
 */

async function workflowFor(form) {
  const row = await FormWorkflow.findOne({ where: { formId: form.id } });
  return cleanWorkflow(form.schema, row ? row.rules : null);
}

async function saveWorkflow(formId, workflow) {
  const row = await FormWorkflow.findOne({ where: { formId } });
  if (row) {
    row.rules = workflow;
    row.changed("rules", true);
    await row.save();
  } else {
    await FormWorkflow.create({ formId, rules: workflow });
  }
}

module.exports = { workflowFor, saveWorkflow };