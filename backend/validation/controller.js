const ExcelJS = require("exceljs");
const { Form, FormValidationEntry } = require("../models");
const { loadWorkbench } = require("../controllers/workbenchAccess");
const { logActivity } = require("../controllers/activity");
const { sortRows } = require("../controllers/sorting");
const { settingsFor, peek, tidy, isEmail } = require("./gate");
const { VALIDATION_SHEET } = require("./sheet");
const { addAddresses } = require("./list");
const sheets = require("../sheets/sync");

/**
 * The signed-in half of form validation: everything the Validation tab in
 * the form editor does.
 *
 * The public half — signing in, and closing an address off once the answers
 * arrive — lives in gate.js and is reached through the form's public routes.
 */

const MODES = ["none", "list", "open"];

/** Loads a form the signed-in user may manage, or answers 404. */
async function loadOwnForm(req, res) {
  const form = await Form.findByPk(req.params.id);
  if (!form) {
    res.status(404).json({ message: "Form not found." });
    return null;
  }
  const access = await loadWorkbench(form.workbenchId);
  if (!access) {
    res.status(404).json({ message: "Form not found." });
    return null;
  }
  return form;
}

const serialiseEntry = (e) => ({
  id: e.id,
  email: e.email,
  status: e.status,
  openedAt: e.openedAt,
  completedAt: e.completedAt,
  responseId: e.responseId,
});

const serialiseSettings = (s) => ({
  mode: s.mode,
  allowResume: s.allowResume,
  notListedMessage: s.notListedMessage || "",
  alreadyDoneMessage: s.alreadyDoneMessage || "",
});

/** Counts for the tab's summary line. */
function tally(entries) {
  return {
    total: entries.length,
    done: entries.filter((e) => e.status === "done").length,
    opened: entries.filter((e) => e.status === "opened").length,
    waiting: entries.filter((e) => e.status === "waiting").length,
  };
}

/* ------------------------------ reading ------------------------------ */

/** GET /api/forms/:id/validation */
exports.get = async (req, res, next) => {
  try {
    const form = await loadOwnForm(req, res);
    if (!form) return undefined;

    const settings = await settingsFor(form.id);
    const all = await FormValidationEntry.findAll({ where: { formId: form.id } });
    const entries = sortRows(all, [["email", "ASC"]]);

    return res.json({
      validation: serialiseSettings(settings),
      entries: entries.map(serialiseEntry),
      counts: tally(entries),
    });
  } catch (err) {
    return next(err);
  }
};

/* ------------------------------ writing ------------------------------ */

/**
 * PATCH /api/forms/:id/validation
 * Changes the way a form works, and the wording on its two refusals.
 *
 * Switching away from a customer list keeps the list itself: someone who
 * tries "no validation" for an afternoon should not lose the addresses
 * they pasted in. Clearing it is a separate, deliberate button.
 */
exports.update = async (req, res, next) => {
  try {
    const form = await loadOwnForm(req, res);
    if (!form) return undefined;

    const settings = await settingsFor(form.id);
    const patch = {};

    if (req.body.mode !== undefined) {
      if (!MODES.includes(req.body.mode)) {
        return res.status(400).json({ message: "That is not one of the three ways." });
      }
      patch.mode = req.body.mode;
    }

    if (req.body.allowResume !== undefined) patch.allowResume = Boolean(req.body.allowResume);

    ["notListedMessage", "alreadyDoneMessage"].forEach((key) => {
      if (req.body[key] !== undefined) {
        patch[key] = req.body[key] ? String(req.body[key]).slice(0, 300) : null;
      }
    });

    const was = settings.mode;
    await settings.update(patch);

    if (patch.mode && patch.mode !== was) {
      await logActivity(req, {
        entityType: "form",
        entityId: form.id,
        entityName: form.name,
        action: "edited",
        detail: `Validation set to “${patch.mode}”`,
      });
    }

    sheets.schedule(form.id);

    return res.json({ validation: serialiseSettings(settings) });
  } catch (err) {
    return next(err);
  }
};

/**
 * Puts a batch of addresses on a form's customer list and answers with the
 * list as it now stands. Shared by the two ways addresses arrive: a block
 * of text, and an uploaded Excel sheet.
 *
 * Addresses already on the list are left exactly as they are — sending a
 * longer list must never reset somebody who has already finished.
 *
 * `alsoRejected` is anything the caller already knew it could not read.
 */
async function addToList(req, res, form, raw, alsoRejected = []) {
  const result = await addAddresses(form.id, raw, alsoRejected);

  if (!result.wanted) {
    return res.status(400).json({
      message: result.rejected.length
        ? `No usable addresses. ${result.rejected.length} could not be read, such as “${result.rejected[0]}”.`
        : "No addresses were found.",
      rejected: result.rejected,
    });
  }

  await logActivity(req, {
    entityType: "form",
    entityId: form.id,
    entityName: form.name,
    action: "edited",
    detail: `${result.added} address${result.added === 1 ? "" : "es"} added to the validation list`,
  });

  // A linked Google Sheet is told about the new addresses straight away.
  sheets.schedule(form.id);

  const all = await FormValidationEntry.findAll({ where: { formId: form.id } });
  const entries = sortRows(all, [["email", "ASC"]]);

  return res.status(201).json({
    added: result.added,
    skipped: result.skipped,
    rejected: result.rejected,
    entries: entries.map(serialiseEntry),
    counts: tally(entries),
  });
}

/**
 * POST /api/forms/:id/validation/entries
 * Adds addresses to the customer list. Takes { emails: [...] } or one
 * block of text in { text }.
 */
exports.addEntries = async (req, res, next) => {
  try {
    const form = await loadOwnForm(req, res);
    if (!form) return undefined;

    const raw = Array.isArray(req.body.emails)
      ? req.body.emails
      : String(req.body.text || "").split(/[\s,;]+/);

    return await addToList(req, res, form, raw);
  } catch (err) {
    return next(err);
  }
};

/* How much of an uploaded sheet is read. A customer list is a column of
   addresses; anything far beyond this is not one. */
const MAX_IMPORT_ROWS = 20000;
const MAX_IMPORT_COLUMNS = 20;

/** Whatever a cell shows, as plain text: links, formulas and styled text included. */
function cellText(cell) {
  try {
    return String(cell.text ?? "").trim();
  } catch {
    return "";
  }
}

/**
 * POST /api/forms/:id/validation/import
 * Reads a customer list out of an uploaded .xlsx file.
 *
 * The file is the same workbook the app hands out: the addresses are read
 * from column A of the "Validation List" sheet (or of the first sheet, for
 * a workbook made by hand). The status and date columns are ignored — who
 * has filled the form in is decided by the app, never by a spreadsheet, so
 * typing "Yes" next to an address changes nothing.
 *
 * Like every other way of adding, it only ever adds: addresses already on
 * the list keep their status.
 */
exports.importSheet = async (req, res, next) => {
  try {
    const form = await loadOwnForm(req, res);
    if (!form) return undefined;

    const file = req.body;
    // Every .xlsx is a zip archive, and every zip starts with "PK".
    if (!Buffer.isBuffer(file) || file.length < 4 || file[0] !== 0x50 || file[1] !== 0x4b) {
      return res
        .status(400)
        .json({ message: "Choose an Excel file (.xlsx). Older .xls and .csv files are not read." });
    }

    const book = new ExcelJS.Workbook();
    try {
      await book.xlsx.load(file);
    } catch {
      return res.status(400).json({ message: "That Excel file could not be opened." });
    }

    const sheet = book.getWorksheet(VALIDATION_SHEET) || book.worksheets[0];
    if (!sheet) return res.status(400).json({ message: "That Excel file has no sheets in it." });

    const found = [];
    const unread = [];
    const last = Math.min(sheet.rowCount, MAX_IMPORT_ROWS);

    for (let n = 1; n <= last; n += 1) {
      const row = sheet.getRow(n);
      const first = cellText(row.getCell(1));

      // Column A is where the address belongs; a list typed into another
      // column by hand is still found.
      let email = isEmail(tidy(first)) ? first : "";
      for (let c = 2; !email && c <= MAX_IMPORT_COLUMNS; c += 1) {
        const text = cellText(row.getCell(c));
        if (isEmail(tidy(text))) email = text;
      }

      if (email) found.push(email);
      // Row 1 is the heading. Any later row with something in column A
      // that is not an address is reported back.
      else if (first && n > 1 && unread.length < 20) unread.push(first.slice(0, 120));
    }

    return await addToList(req, res, form, found, unread);
  } catch (err) {
    return next(err);
  }
};

/** DELETE /api/forms/:id/validation/entries/:entryId — take one address off. */
exports.removeEntry = async (req, res, next) => {
  try {
    const form = await loadOwnForm(req, res);
    if (!form) return undefined;

    const entry = await FormValidationEntry.findOne({
      where: { id: req.params.entryId, formId: form.id },
    });
    if (!entry) return res.status(404).json({ message: "That address is not on the list." });

    const email = entry.email;
    await entry.destroy();

    return res.json({ message: `${email} was removed.` });
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/forms/:id/validation/entries/:entryId/reset
 * Puts one address back to the start, so a customer who needs another go
 * can have one without being deleted and re-added.
 */
exports.resetEntry = async (req, res, next) => {
  try {
    const form = await loadOwnForm(req, res);
    if (!form) return undefined;

    const entry = await FormValidationEntry.findOne({
      where: { id: req.params.entryId, formId: form.id },
    });
    if (!entry) return res.status(404).json({ message: "That address is not on the list." });

    await entry.update({
      status: "waiting",
      openedAt: null,
      completedAt: null,
      responseId: null,
      ticket: null,
    });

    return res.json({ entry: serialiseEntry(entry) });
  } catch (err) {
    return next(err);
  }
};

/** DELETE /api/forms/:id/validation/entries — empty the list entirely. */
exports.clearEntries = async (req, res, next) => {
  try {
    const form = await loadOwnForm(req, res);
    if (!form) return undefined;

    const removed = await FormValidationEntry.destroy({ where: { formId: form.id } });

    await logActivity(req, {
      entityType: "form",
      entityId: form.id,
      entityName: form.name,
      action: "edited",
      detail: "Validation list cleared",
    });

    return res.json({ removed });
  } catch (err) {
    return next(err);
  }
};

module.exports.peekMode = peek;