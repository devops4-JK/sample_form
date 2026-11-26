/**
 * Checks the Google Sheets link, step by step, and says which step fails.
 *
 *   node sheets/check.js
 *   node sheets/check.js "https://docs.google.com/spreadsheets/d/…/edit"
 *
 * With a sheet's link it also tests that one sheet directly, before it is
 * linked, and says exactly why Google refuses it if it does.
 *
 * Run it from the backend folder while the database is reachable. It only
 * reads: nothing in the database or in any sheet is changed. It never
 * prints the key itself.
 */
require("dotenv").config();

const google = require("./google");
const { sequelize, Form, FormSheet, FormValidation } = require("../models");

const ok = (msg) => console.log(`  OK    ${msg}`);
const bad = (msg) => console.log(`  FIX   ${msg}`);

async function run() {
  console.log("\nGoogle Sheets check\n");

  /* 1. the key */
  console.log("1. Service account key");
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_FILE) {
    bad("GOOGLE_SERVICE_ACCOUNT_FILE is not set in backend/.env (remove the # in front of it).");
    return;
  }
  if (!google.isConfigured()) {
    bad(`The key file named in .env could not be read: ${process.env.GOOGLE_SERVICE_ACCOUNT_FILE}`);
    return;
  }
  ok(`Key found. Sheets must be shared with: ${google.serviceEmail()}`);

  /* 1b. one sheet, tested directly */
  const given = process.argv[2];
  if (given) {
    console.log("\n1b. The sheet you gave");
    const id = google.spreadsheetIdFrom(given);
    if (!id) {
      bad("That is not a Google Sheet link. Copy it from the address bar of the open sheet.");
      return;
    }
    ok(`Link read. Sheet id: ${id}`);
    try {
      const info = await google.describe(id);
      ok(`Google let the app open it: “${info.title}”. Tabs: ${info.tabs.join(", ") || "(none)"}`);
      ok("This sheet is ready. Press Link sheet on the form's Connect tab.");
    } catch (err) {
      bad(err.message);
      if (/Share it with/.test(err.message)) {
        console.log("        Open the sheet › Share › add the address above as Editor › Share.");
        console.log("        If Google says you cannot share outside your organisation, your");
        console.log("        Google Workspace admin is blocking it: use a sheet made with a");
        console.log("        personal Gmail account, or ask the admin to allow this address.");
      }
    }
  }

  /* 2. the database */
  console.log("\n2. Database");
  await sequelize.authenticate();
  await sequelize.sync();
  ok("Connected.");

  /* 3. which forms are linked */
  console.log("\n3. Forms linked to a Google Sheet");
  const links = await FormSheet.findAll();
  if (!links.length) {
    bad("No form is linked to a Google Sheet yet.");
    console.log("        This is why nothing updates. Open the form › Connect tab ›");
    console.log("        Google Sheets card › paste the sheet's link › press Link sheet.");
    console.log("        A downloaded .xlsx file is never updated; only a linked Google Sheet is.");
    return;
  }

  for (const link of links) {
    const form = await Form.findByPk(link.formId);
    const mode = (await FormValidation.findOne({ where: { formId: link.formId } }))?.mode || "none";
    const name = form ? `“${form.name}”` : `form ${link.formId} (deleted)`;
    console.log(`\n   ${name}  — validation: ${mode}`);
    console.log(`   Sheet: https://docs.google.com/spreadsheets/d/${link.spreadsheetId}/edit`);
    console.log(
      `   Last updated: ${link.lastSyncedAt ? new Date(link.lastSyncedAt).toLocaleString() : "never"}`
    );
    if (link.lastError) bad(`Last attempt failed: ${link.lastError}`);

    /* 4. can Google be reached, and is this sheet shared with the app? */
    try {
      const info = await google.describe(link.spreadsheetId);
      ok(`Google answered. Sheet name: “${info.title}”. Tabs: ${info.tabs.join(", ") || "(none)"}`);

      const missing = ["Responses", "Validation List"].filter((t) => !info.tabs.includes(t));
      if (missing.length) bad(`Missing tab(s): ${missing.join(", ")} — press "Update now" on the Connect tab.`);

      if (info.tabs.includes("Validation List")) {
        const rows = await google.read(link.spreadsheetId, "'Validation List'!A1:C200");
        ok(`Validation List has ${Math.max(rows.length - 1, 0)} row(s) under the heading.`);
        rows.slice(1, 6).forEach((r) => console.log(`        ${r.join("  |  ")}`));
      }
    } catch (err) {
      bad(err.message);
      if (/could not reach Google/i.test(err.message)) {
        console.log("        This computer cannot reach Google. Check its internet / proxy / firewall.");
      } else if (/not accept the service account key/i.test(err.message)) {
        console.log("        Check that the Google Sheets API is enabled in the same Google Cloud project as the key.");
      }
    }
  }
}

run()
  .catch((err) => {
    console.log(`\n  FIX   ${err.message}`);
    if (/Sheets API has not been used|SERVICE_DISABLED|disabled/i.test(err.message)) {
      console.log("        Enable the Google Sheets API in Google Cloud › APIs & Services › Library.");
    }
  })
  .finally(() => sequelize.close().then(() => console.log("")));