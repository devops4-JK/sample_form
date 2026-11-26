/**
 * Form workflow: logic jumps between pages, and the flow map that shows them.
 *
 * Everything about it lives in this folder —
 *
 *   engine.js      which page comes next for a set of answers. The same file
 *                  runs in the browser (frontend/src/components/workflow).
 *   clean.js       rebuilds a workflow sent by the editor; never trusted as is.
 *   store.js       reading and saving it.
 *   controller.js  the Workflow tab in the form editor.
 *   routes.js      mounted at /api/forms/:id/workflow
 *   model.js       the form_workflows table (registered in models/index.js).
 *
 *   automations.js           webhook + emails after a finished submission
 *   automationController.js  the Automations section of the Workflow tab
 *   automationModels.js      form_automations and form_automation_logs
 *   webhook.js               signed, private-network-proof webhook sender
 *   mailer.js                email through the organisation's SMTP server
 */

const engine = require("./engine");
const { cleanWorkflow } = require("./clean");
const { workflowFor } = require("./store");

module.exports = {
  routes: require("./routes"),
  workflowFor,
  cleanWorkflow,
  nextStep: engine.nextStep,
  pathOf: engine.pathOf,
  run: engine.run,
};