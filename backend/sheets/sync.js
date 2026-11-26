const { Form, FormResponse, FormSheet, FormValidationEntry } = require("../models");
const { buildTable, localStamp } = require("../controllers/formSchema");
const { sortRows } = require("../controllers/sorting");
const { peek } = require("../validation/gate");
const { addAddresses } = require("../validation/list");
const { VALIDATION_SHEET, VALIDATION_HEADER } = require("../validation/sheet");
const google = require("./google");

/**
 * Keeps a form and its linked Google Sheet in step, in both directions.
 *
 *   sheet → app   Column A of the "Validation List" tab is the customer
 *                 list. Any address typed there is added to the form's list.
 *
 *   app → sheet   Columns B and C of that tab (status, date and time) and
 *                 the whole "Responses" tab are written by the app.
 *
 * Who owns what is the rule that makes this safe:
 *
 *   - Column A belongs to the person. The app never rewrites or reorders
 *     it; it only adds, at the bottom, addresses that reached the list some
 *     other way (an uploaded file, or the form signing people in itself).
 *   - Columns B and C, and the Responses tab, belong to the app. Whatever
 *     is typed there is overwritten. Typing "Yes" next to an address does
 *     not mark anybody as finished: the form decides that.
 *
 * Like every other way of adding addresses, the sheet only ever adds.
 * Deleting a row from the sheet does not take that address off the list.
 *
 * When it runs: straight after anything changes in the app, every few
 * seconds in the background, and at the moment someone not yet on the list
 * tries to sign in — so an address typed into the sheet a second ago
 * already opens the form.
 */

const RESPONSES_SHEET = "Responses";
const TABS = [RESPONSES_SHEET, VALIDATION_SHEET];

const SAY = { done: "Yes", opened: "No", waiting: "" };

/* How far down column A is read, and how many blank rows are written under
   the list so statuses left behind by deleted rows are wiped. */
const MAX_ROWS = 20000;
const PADDING = 50;

const seconds = (name, fallback) => {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n >= 5 ? n : fallback;
};
const INTERVAL_MS = seconds("SHEET_SYNC_SECONDS", 15) * 1000;

/* ------------------------------ one at a time ------------------------------ */

/* Two syncs of the same form must never overlap, or one would write over
   the other half way through. Each form has its own queue. */
const queues = new Map();

function inTurn(formId, job) {
  const before = queues.get(formId) || Promise.resolve();
  const mine = before.catch(() => {}).then(job);

  // What the next caller waits behind. Removed once it is the last in line.
  const tail = mine.catch(() => {}).finally(() => {
    if (queues.get(formId) === tail) queues.delete(formId);
  });
  queues.set(formId, tail);

  return mine;
}

/* What was last written to each sheet, so an idle form costs one read and
   no writes. Forgotten on restart, which only means one extra write. */
const written = new Map();

/* ------------------------------ the sync itself ------------------------------ */

const cell = (v) => (v instanceof Date ? localStamp(v) : v === undefined || v === null ? "" : v);

async function run(formId, link) {
  const form = await Form.findByPk(formId);
  if (!form) return;

  const id = link.spreadsheetId;
  const settings = await peek(formId);
  const gated = settings.mode !== "none";
  const memo = written.get(formId) || {};

  /* ---- sheet → app: read column A, add what is new ---- */

  let columnA = [];
  if (gated) {
    const rows = await google.read(id, `'${VALIDATION_SHEET}'!A1:A${MAX_ROWS}`);
    columnA = rows.map((r) => String(r?.[0] ?? "").trim());
    // Blank rows under the list are not part of it.
    while (columnA.length && !columnA[columnA.length - 1]) columnA.pop();

    // Row 1 is the heading. On a customer list, everything under it that
    // is an address goes on the list.
    if (settings.mode === "list") await addAddresses(formId, columnA.slice(1));
  }

  /* ---- app → sheet: statuses beside each address ---- */

  const all = gated ? await FormValidationEntry.findAll({ where: { formId } }) : [];
  const entries = sortRows(all, [["email", "ASC"]]);

  if (gated) {
    const byEmail = new Map(entries.map((e) => [e.email, e]));
    const inSheet = new Set();

    // One status row for every row the person has in column A, in their
    // order, so nothing they typed ever moves.
    const status = columnA.slice(1).map((text) => {
      const entry = byEmail.get(text.toLowerCase());
      if (!entry) return ["", ""];
      inSheet.add(entry.email);
      return [SAY[entry.status] ?? "", entry.completedAt ? localStamp(new Date(entry.completedAt)) : ""];
    });

    // Addresses on the list that are not in the sheet go at the bottom.
    const extra = entries
      .filter((e) => !inSheet.has(e.email))
      .map((e) => [
        e.email,
        SAY[e.status] ?? "",
        e.completedAt ? localStamp(new Date(e.completedAt)) : "",
      ]);

    const fingerprint = JSON.stringify([columnA, status, extra]);
    if (fingerprint !== memo.validation) {
      const first = Math.max(columnA.length, 1) + 1; // first row under the list
      const blanks = Array.from({ length: PADDING }, () => ["", ""]);

      await google.write(id, `'${VALIDATION_SHEET}'!A1:C1`, [VALIDATION_HEADER]);
      await google.write(id, `'${VALIDATION_SHEET}'!B2`, [...status, ...blanks]);
      if (extra.length) await google.write(id, `'${VALIDATION_SHEET}'!A${first}`, extra);

      // With rows added underneath, what was read is no longer what is
      // there; leave no fingerprint so the next pass re-reads and settles.
      memo.validation = extra.length ? null : fingerprint;
    }
  }

  /* ---- app → sheet: the Responses tab ---- */

  const found = await FormResponse.findAll({ where: { formId } });
  const responses = sortRows(found, [["createdAt", "ASC"]]);

  const byResponse = new Map();
  entries.forEach((e) => {
    if (e.responseId) byResponse.set(Number(e.responseId), e.email);
  });
  const emailFor = gated ? (r) => byResponse.get(Number(r.id)) || "" : null;

  const { header, rows } = buildTable(form, responses, emailFor);
  const table = [header, ...rows].map((r) => r.map(cell));

  const fingerprint = JSON.stringify(table);
  if (fingerprint !== memo.responses) {
    // Cleared first only when the table got smaller or changed shape, so
    // nothing stale is left beside or below it.
    const shrank =
      !memo.shape || memo.shape.rows > table.length || memo.shape.columns !== header.length;
    if (shrank) await google.clear(id, `'${RESPONSES_SHEET}'`);
    await google.write(id, `'${RESPONSES_SHEET}'!A1`, table);

    memo.responses = fingerprint;
    memo.shape = { rows: table.length, columns: header.length };
  }

  written.set(formId, memo);
}

/**
 * Brings one form and its sheet into step. Resolves with
 * { connected, ok, error } and never throws: a sheet that cannot be reached
 * must not break a submission or a sign-in.
 */
function syncForm(formId) {
  const key = Number(formId);

  return inTurn(key, async () => {
    const link = await FormSheet.findOne({ where: { formId: key } });
    if (!link) return { connected: false };
    if (!google.isConfigured()) {
      return { connected: true, ok: false, error: "Google Sheets is not set up on the server yet." };
    }

    try {
      try {
        await run(key, link);
      } catch (err) {
        // A tab was renamed or deleted in the sheet: put it back, try once more.
        if (!err.missingTab) throw err;
        await google.ensureTabs(link.spreadsheetId, TABS);
        written.delete(key);
        await run(key, link);
      }

      await link.update({ lastSyncedAt: new Date(), lastError: null });
      return { connected: true, ok: true };
    } catch (err) {
      written.delete(key);
      const message = err.sheet
        ? err.message
        : "The sheet could not be updated. The app will keep trying.";
      if (!err.sheet) console.warn(`Sheet sync for form ${key} failed:`, err.message);
      await link.update({ lastError: message.slice(0, 300) }).catch(() => {});
      return { connected: true, ok: false, error: message };
    }
  });
}

/* ------------------------------ when it runs ------------------------------ */

const pending = new Map();

/**
 * Asks for a sync shortly. Safe to call from anywhere, any number of
 * times: calls within the same second become one sync, and a form with no
 * linked sheet costs one small lookup.
 */
function schedule(formId) {
  const key = Number(formId);
  if (!google.isConfigured() || pending.has(key)) return;

  pending.set(
    key,
    setTimeout(() => {
      pending.delete(key);
      syncForm(key).catch(() => {});
    }, 800)
  );
}

/* The sign-in gate asks for this when an address is not on the list, in
   case it was typed into the sheet a moment ago. Held to one read every
   few seconds per form, so nobody can use the gate to run up Google's
   request limit. */
const lastLook = new Map();

async function refreshListNow(formId) {
  const key = Number(formId);
  if (!google.isConfigured()) return false;

  const now = Date.now();
  if (now - (lastLook.get(key) || 0) < 3000) return false;
  lastLook.set(key, now);

  const result = await syncForm(key);
  return Boolean(result.ok);
}

let timer = null;

/** Starts the background pass over every linked form. Called once at start-up. */
function start() {
  if (timer || !google.isConfigured()) return;

  let busy = false;
  timer = setInterval(async () => {
    if (busy) return; // a slow pass is never overlapped by the next one
    busy = true;
    try {
      const links = await FormSheet.findAll({ attributes: ["formId"] });
      for (const link of links) {
        // One after another: gentle on Google's per-minute limits.
        // eslint-disable-next-line no-await-in-loop
        await syncForm(link.formId);
      }
    } catch (err) {
      console.warn("Sheet sync pass failed:", err.message);
    } finally {
      busy = false;
    }
  }, INTERVAL_MS);
  timer.unref?.();

  console.log(`Google Sheets sync is on (every ${INTERVAL_MS / 1000}s) as ${google.serviceEmail()}.`);
}

/** Forgets what was written to a form's sheet, e.g. when it is re-linked. */
const forget = (formId) => written.delete(Number(formId));

module.exports = { TABS, syncForm, schedule, refreshListNow, start, forget };