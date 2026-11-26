const crypto = require("crypto");
const ExcelJS = require("exceljs");
const { Form, FormResponse, FormIntegration } = require("../models");
const { loadWorkbench } = require("./workbenchAccess");
const { sortRows } = require("./sorting");
const { buildTable, toCsv, excelLocalDate, fileNameFor } = require("./formSchema");
const {
  VALIDATION_SHEET,
  VALIDATION_HEADER,
  validationSheet,
} = require("../validation/sheet");

const newToken = () => crypto.randomBytes(24).toString("base64url");

/** What the Connect tab needs. The client builds the full URL from the token. */
function describe(row) {
  if (!row) return { enabled: false };
  return {
    enabled: true,
    token: row.token,
    createdAt: row.createdAt,
    lastSyncedAt: row.lastSyncedAt,
    syncCount: row.syncCount,
  };
}

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

async function writeXlsx(res, form, responses) {
  /* Who was allowed to fill this form in. Ways 1 and 2 give a list to
     print; way 3 — no validation — gives nothing, and the second sheet is
     left out of the workbook entirely. */
  const gate = await validationSheet(form.id);

  const { header, rows } = buildTable(form, responses, gate.emailFor);

  const book = new ExcelJS.Workbook();
  book.creator = "companystore.io";
  book.created = new Date();

  const sheet = book.addWorksheet("Responses", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  sheet.columns = header.map((h, i) => ({
    header: h,
    key: `c${i}`,
    width: Math.min(48, Math.max(14, String(h).length + 4)),
  }));
  rows.forEach((r) => sheet.addRow(r.map((v) => (v instanceof Date ? excelLocalDate(v) : v))));

  const head = sheet.getRow(1);
  head.font = { bold: true };
  head.alignment = { vertical: "middle" };
  sheet.getColumn(1).numFmt = "dd mmm yyyy hh:mm";
  if (header.length) {
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: header.length } };
  }

  /* The second sheet: every address this form was opened to, and how far
     each of them got. Only for a form that validates who may fill it in. */
  if (gate.show) {
    const list = book.addWorksheet(VALIDATION_SHEET, {
      views: [{ state: "frozen", ySplit: 1 }],
    });

    list.columns = VALIDATION_HEADER.map((h, i) => ({
      header: h,
      key: `v${i}`,
      width: h === "Validation" ? 38 : 22,
    }));

    gate.rows.forEach((r) =>
      list.addRow(r.map((v) => (v instanceof Date ? excelLocalDate(v) : v)))
    );

    const listHead = list.getRow(1);
    listHead.font = { bold: true };
    listHead.alignment = { vertical: "middle" };
    list.getColumn(3).numFmt = "yyyy-mm-dd hh:mm:ss";
    list.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: VALIDATION_HEADER.length },
    };
  }

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader("Content-Disposition", `attachment; filename="${fileNameFor(form)}.xlsx"`);
  await book.xlsx.write(res);
  res.end();
}

/* ============================ SIGNED IN ============================ */

/** GET /api/forms/:id/integrations */
exports.status = async (req, res, next) => {
  try {
    const form = await loadOwnForm(req, res);
    if (!form) return undefined;

    const excel = await FormIntegration.findOne({ where: { formId: form.id, type: "excel" } });
    return res.json({ excel: describe(excel) });
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/forms/:id/integrations/excel
 * Turns the feed on, or issues a fresh token if it is already on. A fresh
 * token means every earlier copy of the URL stops working.
 */
exports.enableExcel = async (req, res, next) => {
  try {
    const form = await loadOwnForm(req, res);
    if (!form) return undefined;

    let row = await FormIntegration.findOne({ where: { formId: form.id, type: "excel" } });
    if (row) {
      row.token = newToken();
      row.lastSyncedAt = null;
      row.syncCount = 0;
      await row.save();
    } else {
      row = await FormIntegration.create({ formId: form.id, type: "excel", token: newToken() });
    }

    form.integrations = true;
    await form.save();

    return res.status(201).json({ excel: describe(row) });
  } catch (err) {
    return next(err);
  }
};

/** DELETE /api/forms/:id/integrations/excel — the URL stops working at once. */
exports.disableExcel = async (req, res, next) => {
  try {
    const form = await loadOwnForm(req, res);
    if (!form) return undefined;

    await FormIntegration.destroy({ where: { formId: form.id, type: "excel" } });

    const others = await FormIntegration.count({ where: { formId: form.id } });
    form.integrations = others > 0;
    await form.save();

    return res.json({ excel: describe(null) });
  } catch (err) {
    return next(err);
  }
};

/** GET /api/forms/:id/export.xlsx — a one-off download for the signed-in user. */
exports.downloadXlsx = async (req, res, next) => {
  try {
    const form = await loadOwnForm(req, res);
    if (!form) return undefined;

    const rows = await FormResponse.findAll({ where: { formId: form.id } });
    return await writeXlsx(res, form, sortRows(rows, [["createdAt", "ASC"]]));
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/forms/:id/export.csv — the responses as a CSV file, for the
 * signed-in user.
 *
 * A CSV file holds one table, so this is the Responses sheet only. On a
 * form that validates who fills it in, each row still names the address it
 * was validated against. The Validation List is in the .xlsx download.
 */
exports.downloadCsv = async (req, res, next) => {
  try {
    const form = await loadOwnForm(req, res);
    if (!form) return undefined;

    const rows = await FormResponse.findAll({ where: { formId: form.id } });
    const responses = sortRows(rows, [["createdAt", "ASC"]]);
    const gate = await validationSheet(form.id);

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${fileNameFor(form)}.csv"`);
    return res.send(toCsv(buildTable(form, responses, gate.emailFor)));
  } catch (err) {
    return next(err);
  }
};

/* ============================ PUBLIC FEED ============================ */

/**
 * GET /api/integrations/excel/:token.xlsx
 *
 * No login: the token is the key. Excel pulls this URL and re-pulls it on
 * every Refresh. It serves a workbook and nothing else — there is no CSV
 * version, so an answer that starts with "=" can never be read as a formula.
 */
exports.publicFeed = async (req, res, next) => {
  try {
    const token = String(req.params.token || "");

    // A real token is 32 URL-safe characters. Anything else is not looked up.
    const row = /^[A-Za-z0-9_-]{20,64}$/.test(token)
      ? await FormIntegration.findOne({ where: { token, type: "excel" } })
      : null;
    if (!row) {
      return res
        .status(404)
        .type("text/plain")
        .send("This Excel link is not active. Turn it on again in the form's Connect tab.");
    }

    const form = await Form.findByPk(row.formId);
    if (!form) return res.status(404).type("text/plain").send("Form not found.");

    const rows = await FormResponse.findAll({ where: { formId: form.id } });
    const responses = sortRows(rows, [["createdAt", "ASC"]]);

    row.lastSyncedAt = new Date();
    row.syncCount += 1;
    await row.save();

    // Excel should always fetch fresh rows, never a cached copy.
    res.setHeader("Cache-Control", "no-store");

    return await writeXlsx(res, form, responses);
  } catch (err) {
    return next(err);
  }
};