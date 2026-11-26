const { FormValidationEntry } = require("../models");
const { settingsFor, tidy, isEmail } = require("./gate");

/**
 * Putting addresses on a form's customer list.
 *
 * One function, used by every way an address can arrive — an uploaded
 * Excel file, a linked Google Sheet, a block of text — so they all follow
 * the same two rules:
 *
 *   - only ever add. An address already on the list is left exactly as it
 *     is, so sending a longer list never resets somebody who has finished.
 *   - anything that is not an address is reported back, never stored.
 */
async function addAddresses(formId, raw, alsoRejected = []) {
  await settingsFor(formId);

  const seen = new Set();
  const wanted = [];
  const rejected = [...alsoRejected];

  (raw || []).forEach((item) => {
    const email = tidy(item);
    if (!email) return;
    if (!isEmail(email) || email.length > 190) {
      if (rejected.length < 20) rejected.push(String(item).trim().slice(0, 120));
      return;
    }
    if (seen.has(email)) return;
    seen.add(email);
    wanted.push(email);
  });

  if (!wanted.length) return { added: 0, skipped: 0, wanted: 0, rejected };

  const existing = await FormValidationEntry.findAll({
    where: { formId },
    attributes: ["email"],
  });
  const have = new Set(existing.map((e) => e.email));

  const fresh = wanted.filter((email) => !have.has(email));
  if (fresh.length) {
    await FormValidationEntry.bulkCreate(
      fresh.map((email) => ({ formId, email, status: "waiting" })),
      // Two sources adding the same address at the same moment is not an error.
      { ignoreDuplicates: true }
    );
  }

  return {
    added: fresh.length,
    skipped: wanted.length - fresh.length,
    wanted: wanted.length,
    rejected,
  };
}

module.exports = { addAddresses };





 