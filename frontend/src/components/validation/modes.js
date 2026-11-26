/**
 * The three ways a form can decide who fills it in.
 *
 * One description, read by the Validation tab in the editor and by the
 * gate on the public form, so the two can never drift apart.
 */

export const MODES = [
  {
    id: "list",
    title: "I have a customer list",
    short: "Customer list",
    blurb:
      "Only the email addresses on your Excel sheet can open the form. Anyone else is turned away, and each address may fill it in once.",
    points: [
      "Add the addresses in the Excel sheet and upload it",
      "An address that is not on the list sees an error page",
      "Once an address has finished, it cannot start again",
    ],
  },
  {
    id: "open",
    title: "I do not have a customer list",
    short: "No list, one go each",
    blurb:
      "Anyone can open the form, but only once. Each address is added to the list the moment it is used, and closed off when the form is finished.",
    points: [
      "No list to prepare — it fills itself in",
      "The address is written down as soon as someone signs in",
      "Coming back after finishing shows an error page",
    ],
  },
  {
    id: "none",
    title: "No validation",
    short: "Open to everyone",
    blurb:
      "No sign-in and no list. Anyone can fill the form in as many times as they like, and every answer is kept.",
    points: [
      "The form opens straight away, with no email asked for",
      "One person may fill it in again and again",
      "No Validation List sheet in the Excel export",
    ],
  },
];

export const modeById = (id) => MODES.find((m) => m.id === id) || MODES[2];

/** What the Validation List sheet prints in its middle column. */
export const STATUS_LABEL = {
  done: "Yes",
  opened: "No",
  waiting: "—",
};

export const STATUS_MEANING = {
  done: "Filled the form in",
  opened: "Opened it, has not finished",
  waiting: "Has not opened it yet",
};

/** "2026-09-21 17:59:37" — the way the sheet shows a time. */
export function stamp(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(
    d.getMinutes()
  )}:${p(d.getSeconds())}`;
}