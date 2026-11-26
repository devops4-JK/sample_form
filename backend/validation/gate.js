const crypto = require("crypto");
const { FormValidation, FormValidationEntry } = require("../models");

/**
 * The gate a respondent passes through before a form will open.
 *
 * Everything the public side needs lives here, so the form controller only
 * has to ask two questions: may this address in, and what should happen to
 * it once the answers arrive.
 *
 * The three ways a form can work are described on the FormValidation model.
 */

/** Addresses are matched lower-cased and trimmed, never as typed. */
const tidy = (email) => String(email || "").trim().toLowerCase();

/* Deliberately forgiving: this is a gate, not an address book. Anything
   shaped like a@b.c gets through and the list decides the rest. */
const LOOKS_LIKE_EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const isEmail = (email) => LOOKS_LIKE_EMAIL.test(tidy(email));

const newTicket = () => crypto.randomBytes(24).toString("base64url");

/**
 * The settings for a form, creating the "no validation" row the first time
 * anybody asks. Always returns something, so no caller has to cope with
 * null.
 */
async function settingsFor(formId) {
  const [row] = await FormValidation.findOrCreate({
    where: { formId },
    defaults: { formId, mode: "none", allowResume: true },
  });
  return row;
}

/** The same, but without writing a row for a form nobody has set up. */
async function peek(formId) {
  const row = await FormValidation.findOne({ where: { formId } });
  return row || { mode: "none", allowResume: true };
}

/* ------------------------------ signing in ------------------------------ */

/**
 * Decides whether an address may open a form, and remembers that it did.
 *
 * Returns either
 *   { ok: true, ticket, email }                  — let them in
 *   { ok: false, reason, message }               — show the error page
 *
 * `reason` is one of:
 *   "not_an_email"  the box was empty or not an address
 *   "not_listed"    way 1 only: this address is not on the customer list
 *   "already_done"  this address has already finished the form
 *   "already_open"  signed in once already, and coming back is not allowed
 */
async function signIn(formId, rawEmail) {
  const settings = await peek(formId);

  // No validation: there is no gate to pass, and nothing is written down.
  if (settings.mode === "none") return { ok: true, ticket: null, email: null };

  const email = tidy(rawEmail);
  if (!isEmail(email)) {
    return {
      ok: false,
      reason: "not_an_email",
      message: "Enter the email address you were invited with.",
    };
  }

  let entry = await FormValidationEntry.findOne({ where: { formId, email } });

  /* Not on the list — but the list may live in a linked Google Sheet, and
     the address may have been typed there a moment ago. Read the sheet
     once and look again before turning anybody away. Required lazily: the
     sync module itself needs this file. */
  if (settings.mode === "list" && !entry) {
    try {
      const refreshed = await require("../sheets/sync").refreshListNow(formId);
      if (refreshed) entry = await FormValidationEntry.findOne({ where: { formId, email } });
    } catch {
      /* The sheet being unreachable must never break the gate. */
    }
  }

  if (settings.mode === "list") {
    // The list is the whole point: an address that is not on it is refused
    // before anything is written down.
    if (!entry) {
      return {
        ok: false,
        reason: "not_listed",
        message:
          settings.notListedMessage ||
          "This email address is not on the list for this form.",
      };
    }
  } else if (!entry) {
    // No list: the address joins it the moment it is used.
    entry = await FormValidationEntry.create({
      formId,
      email,
      status: "waiting",
    });
  }

  if (entry.status === "done") {
    return {
      ok: false,
      reason: "already_done",
      message:
        settings.alreadyDoneMessage ||
        "This form has already been filled in with this email address.",
    };
  }

  if (entry.status === "opened" && !settings.allowResume) {
    return {
      ok: false,
      reason: "already_open",
      message:
        settings.alreadyDoneMessage ||
        "This form has already been opened with this email address.",
    };
  }

  // A fresh ticket every time, so an old browser tab cannot submit twice.
  const ticket = newTicket();
  await entry.update({
    status: "opened",
    openedAt: entry.openedAt || new Date(),
    ticket,
  });

  return { ok: true, ticket, email: entry.email };
}

/* ------------------------------ finishing ------------------------------ */

/**
 * Checks a ticket at submission time, before any answers are stored.
 *
 * Returns { ok: true, entry } — entry is null when the form has no
 * validation — or { ok: false, reason, message }.
 */
async function claim(formId, ticket) {
  const settings = await peek(formId);
  if (settings.mode === "none") return { ok: true, entry: null };

  if (!ticket) {
    return {
      ok: false,
      reason: "no_ticket",
      message: "Your sign-in has expired. Open the form again to carry on.",
    };
  }

  const entry = await FormValidationEntry.findOne({ where: { formId, ticket } });
  if (!entry) {
    return {
      ok: false,
      reason: "no_ticket",
      message: "Your sign-in has expired. Open the form again to carry on.",
    };
  }

  if (entry.status === "done") {
    return {
      ok: false,
      reason: "already_done",
      message:
        settings.alreadyDoneMessage ||
        "This form has already been filled in with this email address.",
    };
  }

  return { ok: true, entry };
}

/**
 * Marks an address finished once its answers are safely stored. Only a
 * completed submission closes the gate — a half-filled form leaves the
 * address on "No" so the customer can come back to it.
 */
async function markDone(entry, responseId, completed = true) {
  if (!entry) return;
  if (!completed) return;

  await entry.update({
    status: "done",
    completedAt: new Date(),
    responseId: responseId || null,
    ticket: null, // spent
  });
}

module.exports = {
  tidy,
  isEmail,
  settingsFor,
  peek,
  signIn,
  claim,
  markDone,
};