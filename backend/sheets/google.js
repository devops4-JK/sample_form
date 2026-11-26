const fs = require("fs");
const path = require("path");
const jwt = require("jsonwebtoken");

/**
 * The few Google Sheets calls the app needs, and signing in to make them.
 *
 * The app signs in as a *service account*: a robot Google account that
 * belongs to this server. A sheet is opened to it the same way it is
 * opened to a colleague — by sharing it with the account's email address
 * as an Editor. Nothing is public, and the app can only reach the sheets
 * that were shared with it.
 *
 * The account's key comes from the file named in GOOGLE_SERVICE_ACCOUNT_FILE
 * (the JSON file Google gives you when you create the key), or from
 * GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_PRIVATE_KEY.
 *
 * Only ever talks to Google's own addresses. What a user supplies is a
 * sheet id, checked against a strict pattern before it goes anywhere.
 */

const TOKEN_URL = process.env.GOOGLE_TOKEN_URL || "https://oauth2.googleapis.com/token";
const API_BASE = process.env.GOOGLE_SHEETS_API_BASE || "https://sheets.googleapis.com";
const SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const TIMEOUT_MS = 12000;

/* ------------------------------ the key ------------------------------ */

let cachedKey; // undefined = not looked for yet, null = looked for, none

function loadKey() {
  if (cachedKey !== undefined) return cachedKey;
  cachedKey = null;

  try {
    const file = process.env.GOOGLE_SERVICE_ACCOUNT_FILE;
    if (file) {
      const full = path.isAbsolute(file) ? file : path.join(__dirname, "..", file);
      const json = JSON.parse(fs.readFileSync(full, "utf8"));
      if (json.client_email && json.private_key) {
        cachedKey = { email: json.client_email, key: json.private_key };
      }
    } else if (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
      cachedKey = {
        email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        // .env files hold the key on one line with \n written out.
        key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      };
    }
  } catch (err) {
    console.warn("Google Sheets: the service account key could not be read:", err.message);
  }

  return cachedKey;
}

/** True once a service account key is in place. */
const isConfigured = () => Boolean(loadKey());

/** The address a sheet must be shared with. */
const serviceEmail = () => loadKey()?.email || null;

/* ------------------------------ signing in ------------------------------ */

let token = null; // { value, expiresAt }

/** An error whose message is written for the person on the Connect tab. */
function sheetError(message, status) {
  const err = new Error(message);
  err.sheet = true;
  err.status = status;
  return err;
}

async function accessToken() {
  if (token && token.expiresAt > Date.now() + 60000) return token.value;

  const account = loadKey();
  if (!account) throw sheetError("Google Sheets is not set up on the server yet.");

  let assertion;
  try {
    assertion = jwt.sign({ scope: SCOPE }, account.key, {
      algorithm: "RS256",
      issuer: account.email,
      audience: "https://oauth2.googleapis.com/token",
      expiresIn: 3600,
    });
  } catch {
    throw sheetError("The Google service account key on the server is not valid.");
  }

  let response;
  try {
    response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw sheetError("The server could not reach Google. Check its internet connection.");
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) {
    throw sheetError("Google did not accept the service account key on the server.");
  }

  token = { value: data.access_token, expiresAt: Date.now() + (data.expires_in || 3600) * 1000 };
  return token.value;
}

/* ------------------------------ the calls ------------------------------ */

/** A sheet id out of its web address, or out of the bare id. Null if neither. */
function spreadsheetIdFrom(input) {
  const text = String(input || "").trim();
  const inUrl = text.match(/\/spreadsheets\/d\/([A-Za-z0-9_-]{20,100})/);
  if (inUrl) return inUrl[1];
  return /^[A-Za-z0-9_-]{20,100}$/.test(text) ? text : null;
}

async function call(method, spreadsheetId, rest = "", body) {
  const bearer = await accessToken();

  let response;
  try {
    response = await fetch(`${API_BASE}/v4/spreadsheets/${spreadsheetId}${rest}`, {
      method,
      headers: {
        Authorization: `Bearer ${bearer}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw sheetError("The server could not reach Google. Check its internet connection.");
  }

  if (response.ok) return response.json().catch(() => ({}));

  const data = await response.json().catch(() => ({}));
  const detail = String(data?.error?.message || "");

  // A 403 is also what Google answers when the Sheets API was never switched
  // on for the project the key belongs to. Say that, not "share the sheet".
  if (response.status === 403 && /has not been used|is disabled|SERVICE_DISABLED|accessNotConfigured/i.test(detail)) {
    throw sheetError(
      "The Google Sheets API is not enabled for the project this key belongs to. In Google Cloud, open APIs & Services › Library › Google Sheets API and press Enable, wait a minute, then try again.",
      403
    );
  }
  if (response.status === 403) {
    throw sheetError(
      `The app is not allowed to open that sheet. Share it with ${serviceEmail()} as an Editor.`,
      403
    );
  }
  if (response.status === 404) {
    throw sheetError("That Google Sheet could not be found. Check the link.", 404);
  }
  if (response.status === 429) {
    throw sheetError("Google is limiting requests for a moment. It will catch up shortly.", 429);
  }
  if (response.status === 400 && /not supported for this document/i.test(detail)) {
    throw sheetError(
      "That file is an Excel file stored in Google Drive, not a Google Sheet. Open it and choose File › Save as Google Sheets, then link the new sheet.",
      400
    );
  }
  if (response.status === 400 && /Unable to parse range/i.test(detail)) {
    const err = sheetError("A tab the app needs is missing from the sheet.", 400);
    err.missingTab = true;
    throw err;
  }
  throw sheetError("Google Sheets answered with an error. Try again in a moment.", response.status);
}

const range = (a1) => `/values/${encodeURIComponent(a1)}`;

/** The sheet's name and the names of its tabs. */
async function describe(spreadsheetId) {
  const data = await call(
    "GET",
    spreadsheetId,
    "?fields=properties.title,sheets.properties.title"
  );
  return {
    title: data?.properties?.title || "",
    tabs: (data?.sheets || []).map((s) => s.properties?.title).filter(Boolean),
  };
}

/** Adds whichever of these tabs the sheet does not have yet. */
async function ensureTabs(spreadsheetId, names) {
  const { title, tabs } = await describe(spreadsheetId);
  const missing = names.filter((n) => !tabs.includes(n));
  if (missing.length) {
    await call("POST", spreadsheetId, ":batchUpdate", {
      requests: missing.map((name) => ({ addSheet: { properties: { title: name } } })),
    });
  }
  return title;
}

/** The cells in a range, as rows of text. Empty cells at the end are left off. */
async function read(spreadsheetId, a1) {
  const data = await call("GET", spreadsheetId, range(a1));
  return data.values || [];
}

/**
 * Writes rows starting at the top-left of a range. Written as plain text
 * and numbers — never parsed — so an answer that starts with "=" lands in
 * the sheet as that text and not as a formula.
 */
async function write(spreadsheetId, a1, values) {
  return call("PUT", spreadsheetId, `${range(a1)}?valueInputOption=RAW`, { values });
}

async function clear(spreadsheetId, a1) {
  return call("POST", spreadsheetId, `${range(a1)}:clear`, {});
}

module.exports = {
  isConfigured,
  serviceEmail,
  spreadsheetIdFrom,
  describe,
  ensureTabs,
  read,
  write,
  clear,
};
