const { Form, FormSheet } = require("../models");
const { loadWorkbench } = require("../controllers/workbenchAccess");
const { logActivity } = require("../controllers/activity");
const google = require("./google");
const sync = require("./sync");

/**
 * The Google Sheets card on the Connect tab: link a sheet to a form, see
 * how the link is doing, sync it now, or unlink it.
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

function describe(link) {
  const base = { configured: google.isConfigured(), serviceEmail: google.serviceEmail() };
  if (!link) return { ...base, connected: false };
  return {
    ...base,
    connected: true,
    title: link.title || "Google Sheet",
    url: `https://docs.google.com/spreadsheets/d/${link.spreadsheetId}/edit`,
    lastSyncedAt: link.lastSyncedAt,
    lastError: link.lastError || "",
  };
}

/** GET /api/forms/:id/sheet */
exports.status = async (req, res, next) => {
  try {
    const form = await loadOwnForm(req, res);
    if (!form) return undefined;
    const link = await FormSheet.findOne({ where: { formId: form.id } });
    return res.json({ sheet: describe(link) });
  } catch (err) {
    return next(err);
  }
};

/**
 * PUT /api/forms/:id/sheet   { url }
 * Links a Google Sheet. The sheet must already be shared with the app's
 * service account as an Editor; this checks that it can be opened, adds
 * the two tabs if they are missing, and runs the first sync.
 */
exports.connect = async (req, res, next) => {
  try {
    const form = await loadOwnForm(req, res);
    if (!form) return undefined;

    if (!google.isConfigured()) {
      return res.status(400).json({ message: "Google Sheets is not set up on the server yet." });
    }

    const spreadsheetId = google.spreadsheetIdFrom(req.body.url);
    if (!spreadsheetId) {
      return res
        .status(400)
        .json({ message: "Paste the link to a Google Sheet, copied from the browser's address bar." });
    }

    let title;
    try {
      title = await google.ensureTabs(spreadsheetId, sync.TABS);
    } catch (err) {
      if (err.sheet) return res.status(400).json({ message: err.message });
      throw err;
    }

    const [link] = await FormSheet.findOrCreate({
      where: { formId: form.id },
      defaults: { formId: form.id, spreadsheetId, title: String(title).slice(0, 200) },
    });
    await link.update({
      spreadsheetId,
      title: String(title).slice(0, 200),
      lastError: null,
      lastSyncedAt: null,
    });
    sync.forget(form.id);

    await logActivity(req, {
      entityType: "form",
      entityId: form.id,
      entityName: form.name,
      action: "edited",
      detail: `Linked to the Google Sheet “${String(title).slice(0, 120)}”`,
    });

    await sync.syncForm(form.id);
    await link.reload();

    return res.status(201).json({ sheet: describe(link) });
  } catch (err) {
    return next(err);
  }
};

/** POST /api/forms/:id/sheet/sync — bring the two into step right now. */
exports.syncNow = async (req, res, next) => {
  try {
    const form = await loadOwnForm(req, res);
    if (!form) return undefined;

    const result = await sync.syncForm(form.id);
    if (!result.connected) return res.status(404).json({ message: "No Google Sheet is linked." });

    const link = await FormSheet.findOne({ where: { formId: form.id } });
    return res.json({ sheet: describe(link) });
  } catch (err) {
    return next(err);
  }
};

/** DELETE /api/forms/:id/sheet — unlink. The sheet itself is left as it is. */
exports.disconnect = async (req, res, next) => {
  try {
    const form = await loadOwnForm(req, res);
    if (!form) return undefined;

    await FormSheet.destroy({ where: { formId: form.id } });
    sync.forget(form.id);

    await logActivity(req, {
      entityType: "form",
      entityId: form.id,
      entityName: form.name,
      action: "edited",
      detail: "Google Sheet unlinked",
    });

    return res.json({ sheet: describe(null) });
  } catch (err) {
    return next(err);
  }
};