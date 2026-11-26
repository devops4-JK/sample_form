/**
 * Reading Form.schema on the server.
 *
 * The builder saves { pages: [{ id, name, fields: [...] }] }. Forms saved
 * before pages existed hold a flat { fields: [...] }; pagesOf() reads both.
 */

/** Element types that show text but collect no answer. */
const DISPLAY_ONLY = new Set([
  "welcome_screen",
  "end_screen",
  "statement",
  "question_group",
  "redirect_url",
]);

/** Keys that become their own columns rather than landing in `settings`. */
const TOP_LEVEL = new Set(["id", "type", "label", "placeholder", "help", "required"]);

/**
 * Pictures live in Form.schema as data URLs and can be megabytes each. The
 * flat copy in form_questions exists for listing and reporting, where a
 * picture is no use, so each one is replaced by this marker instead of
 * being stored a second time.
 */
const PICTURE = "[picture]";
const isDataUrl = (v) => typeof v === "string" && v.startsWith("data:");

function withoutPictures(value, depth = 0) {
  if (isDataUrl(value)) return PICTURE;
  // Deep enough for products inside sets; nothing in a schema goes further.
  if (depth > 4 || !value || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((v) => withoutPictures(v, depth + 1));
  return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, withoutPictures(v, depth + 1)]));
}

function pagesOf(schema) {
  if (schema?.pages?.length) return schema.pages;
  if (schema?.fields?.length) return [{ id: "page_1", name: "Page 1", fields: schema.fields }];
  return [];
}

/** One row per element, ready for FormQuestion.bulkCreate. */
function flattenQuestions(form) {
  const rows = [];
  pagesOf(form.schema).forEach((page, p) => {
    (page.fields || []).forEach((field, i) => {
      const settings = {};
      Object.entries(field).forEach(([k, v]) => {
        if (!TOP_LEVEL.has(k)) settings[k] = withoutPictures(v);
      });

      rows.push({
        formId: form.id,
        formName: form.name,
        pageId: String(page.id || `page_${p + 1}`).slice(0, 64),
        pageName: page.name ? String(page.name).slice(0, 160) : null,
        pageNumber: p + 1,
        position: i + 1,
        fieldId: String(field.id).slice(0, 64),
        type: String(field.type).slice(0, 40),
        label: field.label === undefined || field.label === null ? null : String(field.label),
        placeholder: field.placeholder ? String(field.placeholder).slice(0, 255) : null,
        description: field.help ? String(field.help) : null,
        required: Boolean(field.required),
        collectsAnswer: !DISPLAY_ONLY.has(field.type),
        settings: Object.keys(settings).length ? settings : null,
      });
    });
  });
  return rows;
}

/**
 * Rebuilds a form's rows in form_questions inside the given transaction.
 * Called on every save, so the table always matches the builder.
 */
async function syncQuestions(FormQuestion, form, transaction) {
  await FormQuestion.destroy({ where: { formId: form.id }, transaction });
  const rows = flattenQuestions(form);
  if (rows.length) await FormQuestion.bulkCreate(rows, { transaction });
  return rows.length;
}

/* ------------------------------------------------------------------
   Spreadsheet export
   ------------------------------------------------------------------ */

const clean = (s) => String(s ?? "").replace(/\s+/g, " ").trim();

/**
 * Columns for the export, in page order. Address and contact blocks get one
 * column per visible sub-field, and a matrix gets one column per row, so the
 * sheet stays filterable.
 *
 * Each column is { header, read(answers) }.
 */
function exportColumns(schema) {
  const cols = [];

  pagesOf(schema).forEach((page) => {
    (page.fields || []).forEach((f) => {
      if (DISPLAY_ONLY.has(f.type)) return;
      const title = clean(f.label) || f.type;

      if ((f.type === "address" || f.type === "contact_info") && Array.isArray(f.parts)) {
        f.parts
          .filter((part) => part.show)
          .forEach((part) => {
            cols.push({
              header: `${title} - ${clean(part.label) || part.key}`,
              read: (a) => a?.[f.id]?.[part.key] ?? "",
            });
          });
        return;
      }

      /* A product question: the product picked, and its size in a column
         of its own when any product comes in sizes, so sizes can be
         counted and filtered for ordering. A set of products gets one
         such pair per option. */
      const hasSizes = (products) =>
        (Array.isArray(products) ? products : []).some((p) => p && p.sizeKind && p.sizeKind !== "none");

      if (f.type === "product_choice") {
        cols.push({ header: title, read: (a) => a?.[f.id]?.product ?? "" });
        if (hasSizes(f.products)) {
          cols.push({ header: `${title} - Size`, read: (a) => a?.[f.id]?.size ?? "" });
        }
        return;
      }

      if (f.type === "product_sets" && Array.isArray(f.groups)) {
        f.groups.forEach((g, i) => {
          if (!g) return;
          const name = clean(g.title) || `Option ${i + 1}`;
          cols.push({ header: `${title} - ${name}`, read: (a) => a?.[f.id]?.[g.id] ?? "" });
          if (hasSizes(g.products)) {
            cols.push({ header: `${title} - ${name} - Size`, read: (a) => a?.[f.id]?.[`${g.id}:size`] ?? "" });
          }
        });
        return;
      }

      if (f.type === "matrix" && Array.isArray(f.rows)) {
        f.rows.forEach((row) => {
          cols.push({
            header: `${title} - ${clean(row)}`,
            read: (a) => a?.[f.id]?.[row] ?? "",
          });
        });
        return;
      }

      cols.push({ header: title, read: (a) => a?.[f.id] });
    });
  });

  // Two columns titled the same would be ambiguous in Excel; number the repeats.
  const seen = new Map();
  cols.forEach((c) => {
    const n = (seen.get(c.header) || 0) + 1;
    seen.set(c.header, n);
    if (n > 1) c.header = `${c.header} (${n})`;
  });

  return cols;
}

/** Turns any stored answer into a single spreadsheet cell. */
function cellValue(v) {
  if (v === undefined || v === null) return "";
  if (Array.isArray(v)) return v.join(", ");
  if (typeof v === "object") {
    return Object.entries(v)
      .filter(([, x]) => x !== "" && x !== undefined && x !== null)
      .map(([k, x]) => `${k}: ${x}`)
      .join("; ");
  }
  return v;
}

/**
 * Header row plus one row per response, oldest first.
 *
 * `emailFor` is handed in only when the form is gated: it turns a response
 * into the address that was validated to reach it, so the Responses sheet
 * and the Validation List sheet can be read against each other. A form with
 * no validation passes nothing and the column is left out altogether.
 */
/**
 * Columns for what the Workflow tab adds to a response: values that came in
 * on the link, the score, other variables, tags and the ending shown. Built
 * from the responses themselves, so a form with no workflow gets none, and
 * a hidden field removed later still shows for the answers that carry it.
 */
function workflowColumns(responses) {
  const hidden = [];
  const vars = [];
  let any = false;
  let tags = false;
  let ending = false;
  responses.forEach((r) => {
    const m = r && r.answers && r.answers._meta;
    if (!m || typeof m !== "object") return;
    any = true;
    Object.keys(m.hidden || {}).forEach((k) => !hidden.includes(k) && hidden.push(k));
    Object.keys(m.vars || {}).forEach((k) => k !== "score" && !vars.includes(k) && vars.push(k));
    if (Array.isArray(m.tags) && m.tags.length) tags = true;
    if (m.outcome) ending = true;
  });
  if (!any) return [];
  const meta = (a) => (a && a._meta) || {};
  return [
    ...hidden.map((k) => ({ header: `Link: ${k}`, read: (a) => meta(a).hidden?.[k] ?? "" })),
    { header: "Score", read: (a) => meta(a).score ?? "" },
    ...vars.map((k) => ({ header: `Variable: ${k}`, read: (a) => meta(a).vars?.[k] ?? "" })),
    ...(tags ? [{ header: "Tags", read: (a) => (meta(a).tags || []).join(", ") }] : []),
    ...(ending ? [{ header: "Ending", read: (a) => meta(a).outcome?.title || "" }] : []),
  ];
}

function buildTable(form, responses, emailFor = null) {
  const cols = [...exportColumns(form.schema), ...workflowColumns(responses)];

  const header = [
    "Submitted at",
    "Status",
    ...(emailFor ? ["Validated email"] : []),
    ...cols.map((c) => c.header),
  ];

  const rows = responses.map((r) => [
    new Date(r.createdAt),
    r.completed ? "Completed" : "Partial",
    ...(emailFor ? [emailFor(r) || ""] : []),
    ...cols.map((c) => cellValue(c.read(r.answers))),
  ]);

  return { header, rows };
}

/** "2026-09-22 15:47:03" in the server's own time zone, not UTC. */
function localStamp(d) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/**
 * Excel stores dates without a zone and ExcelJS writes them as UTC. Shifting
 * by the server's offset makes the cell show local time, matching the CSV.
 */
function excelLocalDate(d) {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000);
}

/**
 * A CSV file is plain text, and a spreadsheet opening it will run any cell
 * that looks like a formula. An answer typed as "=HYPERLINK(...)" would
 * become a live formula on the computer of whoever opens the export, so
 * such cells get a leading apostrophe, which spreadsheets read as "this is
 * text". Phone numbers and ordinary negative numbers ("+91 98765 43210",
 * "-12.5") are left alone.
 */
function csvSafe(text) {
  if (/^[=@\t\r]/.test(text)) return `'${text}`;
  if (/^[+-]/.test(text) && !/^[+-]?[\d\s().,-]+$/.test(text)) return `'${text}`;
  return text;
}

function toCsv({ header, rows }) {
  const esc = (v) => {
    const s = v instanceof Date ? localStamp(v) : csvSafe(String(v ?? ""));
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [header, ...rows].map((r) => r.map(esc).join(","));
  // The byte-order mark makes Excel read the file as UTF-8, so ₹ and names in
  // other scripts come through intact.
  return "\uFEFF" + lines.join("\r\n") + "\r\n";
}

/** A filename-safe version of the form name. */
function fileNameFor(form) {
  const base = String(form.name || "form")
    .replace(/[^\w\- ]+/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 60);
  return `${base || "form"}-responses`;
}

module.exports = {
  DISPLAY_ONLY,
  pagesOf,
  flattenQuestions,
  syncQuestions,
  exportColumns,
  workflowColumns,
  cellValue,
  buildTable,
  localStamp,
  toCsv,
  excelLocalDate,
  fileNameFor,
};