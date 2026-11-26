/**
 * Form validation: who may fill a form in.
 *
 * Everything about it lives in this folder —
 *
 *   gate.js        signing in, and closing an address off when the answers
 *                  arrive. The public side.
 *   controller.js  the Validation tab in the form editor. The signed-in side.
 *   routes.js      mounted at /api/forms/:id/validation
 *   sheet.js       the "Validation List" sheet in the Excel export
 *
 * — apart from the two tables, which sit with the other models so a plain
 * sequelize.sync() creates them.
 */

const gate = require("./gate");
const sheet = require("./sheet");

module.exports = {
  routes: require("./routes"),
  signIn: gate.signIn,
  claim: gate.claim,
  markDone: gate.markDone,
  peek: gate.peek,
  settingsFor: gate.settingsFor,
  VALIDATION_SHEET: sheet.VALIDATION_SHEET,
  VALIDATION_HEADER: sheet.VALIDATION_HEADER,
  validationSheet: sheet.validationSheet,
};