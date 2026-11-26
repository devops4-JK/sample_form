const { Workbench } = require("../models");

/** One workbench holds at most this many forms. */
const FORM_LIMIT = 20;

/**
 * Workbenches and forms are shared: everything belongs to the company, not
 * to one person, so any signed-in user may open and edit any of them.
 *
 * This helper only checks that the workbench exists. It stays in place so
 * every controller keeps one obvious spot to tighten later if the rules
 * ever change back.
 */
async function loadWorkbench(workbenchId) {
  const workbench = await Workbench.findByPk(workbenchId);
  if (!workbench) return null;
  return { workbench };
}

module.exports = { FORM_LIMIT, loadWorkbench };