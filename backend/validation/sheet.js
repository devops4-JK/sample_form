const { FormValidationEntry } = require("../models");
const { sortRows } = require("../controllers/sorting");
const { peek } = require("./gate");

/**
 * The "Validation List" sheet in the Excel export.
 *
 * Three columns, exactly as the sheet is read today:
 *
 *   Validation            the email address
 *   Status of validation  "Yes" once the form was finished, "No" once it
 *                         was opened, blank while it has only been listed
 *   Date and Time         when it was finished; blank until then
 *
 * A form with no validation has no list to print, so the sheet is left out
 * of the workbook altogether rather than added empty.
 */

const VALIDATION_SHEET = "Validation List";

const VALIDATION_HEADER = ["Validation", "Status of validation", "Date and Time"];

const SAY = { done: "Yes", opened: "No", waiting: "" };

/**
 * Everything the export needs for one form:
 *   { mode, show, rows, emailFor }
 *
 * `show` is false for an ungated form. `emailFor` turns a response row into
 * the address that was validated to reach it, for the Responses sheet, and
 * is null when there is nothing to look up.
 */
async function validationSheet(formId) {
  const settings = await peek(formId);

  if (settings.mode === "none") {
    return { mode: "none", show: false, rows: [], emailFor: null };
  }

  /* No ORDER BY, for the same reason as everywhere else: sorting happens
     here, where the row width cannot run a buffer out of memory. */
  const all = await FormValidationEntry.findAll({ where: { formId } });
  const entries = sortRows(all, [["email", "ASC"]]);

  const rows = entries.map((e) => [
    e.email,
    SAY[e.status] ?? "",
    e.completedAt ? new Date(e.completedAt) : "",
  ]);

  const byResponse = new Map();
  entries.forEach((e) => {
    if (e.responseId) byResponse.set(Number(e.responseId), e.email);
  });

  return {
    mode: settings.mode,
    show: true,
    rows,
    emailFor: (response) => byResponse.get(Number(response.id)) || "",
  };
}

module.exports = { VALIDATION_SHEET, VALIDATION_HEADER, validationSheet };