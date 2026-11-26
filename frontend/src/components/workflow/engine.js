/**
 * The workflow engine: given a form's pages, its workflow and the answers
 * so far, which page comes next, what the variables and score are, which
 * tags the respondent earns and which ending they see.
 *
 * The SAME file runs in two places — the browser, to move the respondent
 * on, and the server, to decide what really happened (which questions were
 * seen, the score, the tags, the ending). The two copies are
 *
 *   frontend/src/components/workflow/engine.js
 *   backend/workflow/engine.js
 *
 * and must stay identical apart from the export line at the end.
 *
 * A workflow looks like:
 *
 *   { pages:     { [pageId]: { rules: [ { id, match, conditions, goTo } ],
 *                              otherwise: "next" | pageId | "end" } },
 *     hidden:    [ { key } ],                         values read from the link
 *     variables: [ { name, type: "number"|"text", initial } ],
 *     scoring:   { [questionId]: { points: { [option]: n }, addAnswer } },
 *     calcs:     [ { id, pageId, match, conditions, variable, op, value } ],
 *     tags:      [ { id, name, match, conditions } ],
 *     outcomes:  [ { id, title, message, redirect, match, conditions } ] }
 *
 * A condition is { fieldId, op, value }, where fieldId is a question id,
 * "hidden:<key>" or "var:<name>" (var:score is the built-in score).
 *
 * When someone presses Next on a page, its questions' points go onto the
 * score, its calculations run, and then its jump rules are checked top to
 * bottom; the first that matches decides where they go.
 */

/* ------------------------------ the operators ------------------------------ */

/** What each comparison is called on screen. */
const OP_LABELS = {
  is: "is",
  is_not: "is not",
  contains: "contains",
  not_contains: "does not contain",
  eq: "is equal to",
  ne: "is not equal to",
  gt: "is greater than",
  gte: "is at least",
  lt: "is less than",
  lte: "is at most",
  is_empty: "is not answered",
  not_empty: "is answered",
};

/** Which comparisons make sense for each kind of value. */
const OPS_BY_KIND = {
  choice: ["is", "is_not", "is_empty", "not_empty"],
  number: ["eq", "ne", "gt", "gte", "lt", "lte", "is_empty", "not_empty"],
  text: ["is", "is_not", "contains", "not_contains", "is_empty", "not_empty"],
  block: ["contains", "not_contains", "is_empty", "not_empty"],
};

/** Comparisons that need no value typed beside them. */
const NO_VALUE = new Set(["is_empty", "not_empty"]);

/** What a calculation can do to a variable. Text variables can only be set. */
const CALC_OPS = {
  add: "Add",
  subtract: "Subtract",
  multiply: "Multiply by",
  set: "Set to",
};

/** The built-in number every form has, for quizzes and scoring. */
const SCORE = "score";

/** Names for hidden fields and variables: lower case, digits, underscore. */
const NAME_RE = /^[a-z][a-z0-9_]{0,31}$/;

const KIND = {
  multiple_choice: "choice",
  dropdown: "choice",
  picture_choice: "choice",
  yes_no: "choice",
  legal: "choice",
  checkbox: "choice",
  product_choice: "choice",
  number: "number",
  nps: "number",
  opinion_scale: "number",
  rating: "number",
  short_text: "text",
  long_text: "text",
  email: "text",
  website: "text",
  phone: "text",
  date: "text",
  scheduler: "text",
  contact_info: "block",
  address: "block",
  matrix: "block",
  ranking: "block",
  product_sets: "block",
};

/** Questions a rule can look at. Screens, statements and the like cannot. */
const kindOf = (field) => (field && KIND[field.type]) || null;

/** The choices a choice question offers, for the value dropdown. */
function choiceOptions(field) {
  if (!field) return [];
  if (field.type === "yes_no") return ["Yes", "No"];
  if (field.type === "legal") return ["I accept", "I decline"];
  if (field.type === "product_choice") {
    return (field.products || []).map((p) => p && p.name).filter(Boolean);
  }
  return Array.isArray(field.options) ? field.options.filter((o) => typeof o === "string") : [];
}

/* ------------------------------ reading values ------------------------------ */

const norm = (s) => String(s === undefined || s === null ? "" : s).trim().toLowerCase();

/** An answer as a list of plain strings, whatever shape it was stored in. */
function answerList(field, value) {
  if (value === undefined || value === null || value === "") return [];
  if (field && field.type === "product_choice") {
    return value && value.product ? [String(value.product)] : [];
  }
  if (Array.isArray(value)) return value.map((v) => String(v)).filter((v) => v !== "");
  if (typeof value === "object") {
    return Object.keys(value)
      .filter((k) => !/:size$/.test(k))
      .map((k) => value[k])
      .filter((v) => v !== "" && v !== null && v !== undefined)
      .map((v) => String(v));
  }
  return [String(value)];
}

/** Hidden fields and variables declared on a workflow. */
const hiddenOf = (wf) => (wf && Array.isArray(wf.hidden) ? wf.hidden : []);
const variablesOf = (wf) => (wf && Array.isArray(wf.variables) ? wf.variables : []);

/** The variable's type, including the built-in score. */
function variableType(wf, name) {
  if (name === SCORE) return "number";
  const v = variablesOf(wf).find((x) => x && x.name === name);
  return v ? (v.type === "text" ? "text" : "number") : null;
}

/**
 * What a condition can point at:
 *   "<questionId>"   a question's answer
 *   "hidden:<key>"   a value that came in on the link
 *   "var:<name>"     a variable, including var:score
 */
function refOf(ref, wf, fields) {
  const r = String(ref || "");
  if (r.startsWith("hidden:")) {
    const key = r.slice(7);
    return hiddenOf(wf).some((h) => h && h.key === key) ? { kind: "text", hidden: key } : null;
  }
  if (r.startsWith("var:")) {
    const name = r.slice(4);
    const type = variableType(wf, name);
    return type ? { kind: type, variable: name } : null;
  }
  const field = fields[r];
  return field && kindOf(field) ? { kind: kindOf(field), field } : null;
}

/** The value behind a reference, as a list of strings. */
function valuesOf(ref, ctx) {
  if (ref.hidden) {
    const v = ctx.hidden ? ctx.hidden[ref.hidden] : undefined;
    return v === undefined || v === null || v === "" ? [] : [String(v)];
  }
  if (ref.variable) {
    const v = ctx.vars ? ctx.vars[ref.variable] : undefined;
    return v === undefined || v === null || v === "" ? [] : [String(v)];
  }
  return answerList(ref.field, ctx.answers ? ctx.answers[ref.field.id] : undefined);
}

/** Does one comparison hold? */
function compare(kind, op, list, value) {
  if (!OPS_BY_KIND[kind] || !OPS_BY_KIND[kind].includes(op)) return false;
  const empty = list.length === 0;
  const want = norm(value);
  const text = norm(list.join(" "));
  switch (op) {
    case "is_empty":
      return empty;
    case "not_empty":
      return !empty;
    case "is":
      return list.some((x) => norm(x) === want);
    case "is_not":
      return !list.some((x) => norm(x) === want);
    case "contains":
      return want !== "" && text.includes(want);
    case "not_contains":
      return want === "" || !text.includes(want);
    default: {
      const n = Number(list[0]);
      const c = Number(value);
      if (empty || !Number.isFinite(n) || !Number.isFinite(c)) return false;
      if (op === "eq") return n === c;
      if (op === "ne") return n !== c;
      if (op === "gt") return n > c;
      if (op === "gte") return n >= c;
      if (op === "lt") return n < c;
      if (op === "lte") return n <= c;
      return false;
    }
  }
}

/** Every question on pages 0..upTo, by id. upTo = -1 means every page. */
function fieldsUpTo(pages, upTo) {
  const out = {};
  const list = pages || [];
  list.slice(0, upTo < 0 ? list.length : upTo + 1).forEach((p) =>
    (p && Array.isArray(p.fields) ? p.fields : []).forEach((f) => {
      if (f && f.id) out[f.id] = f;
    })
  );
  return out;
}

/**
 * Does a set of conditions match?
 *
 * Logic jumps (strict = false): a condition pointing at something that no
 * longer exists is ignored, and a rule left with none never matches.
 *
 * Calculations, tags and endings (strict = true): no conditions at all
 * means "always"; a condition pointing at something deleted counts as not
 * met, so deleting a question can never make an ending fire for everyone.
 */
function matches(rule, wf, fields, ctx, strict) {
  const raw = rule && Array.isArray(rule.conditions) ? rule.conditions : [];
  if (strict && raw.length === 0) return true;
  const results = [];
  raw.forEach((c) => {
    const ref = c ? refOf(c.fieldId, wf, fields) : null;
    if (!ref) {
      if (strict) results.push(false);
      return;
    }
    results.push(compare(ref.kind, c.op, valuesOf(ref, ctx), c.value));
  });
  if (!results.length) return false;
  return rule.match === "any" ? results.some(Boolean) : results.every(Boolean);
}

/* ------------------------------ variables ------------------------------ */

const tidyNumber = (n) => {
  if (!Number.isFinite(n)) return 0;
  const c = Math.max(-1e9, Math.min(1e9, n));
  return Math.round(c * 10000) / 10000;
};

/** The variables before the first page: everything at its starting value. */
function startVars(wf) {
  const vars = { [SCORE]: 0 };
  variablesOf(wf).forEach((v) => {
    if (!v || !v.name || v.name === SCORE) return;
    vars[v.name] = v.type === "text" ? String(v.initial || "") : tidyNumber(Number(v.initial) || 0);
  });
  return vars;
}

/** Points a scored question gives for its answer. */
function pointsFor(field, rule, value) {
  if (!rule) return 0;
  let total = 0;
  const list = answerList(field, value);
  if (rule.points && typeof rule.points === "object") {
    list.forEach((x) => {
      const p = Number(rule.points[x]);
      if (Number.isFinite(p)) total += p;
    });
  }
  if (rule.addAnswer && kindOf(field) === "number") {
    const n = Number(list[0]);
    if (Number.isFinite(n)) total += n;
  }
  return total;
}

/**
 * The variables after page `index` has been answered: its questions' points
 * go onto the score, then its calculations run in order.
 */
function applyPage(pages, wf, index, answers, hidden, vars) {
  const page = (pages || [])[index];
  if (!page) return vars;
  const next = { ...vars };
  const scoring = (wf && wf.scoring) || {};

  (page.fields || []).forEach((f) => {
    if (f && f.id && scoring[f.id]) {
      next[SCORE] = tidyNumber((Number(next[SCORE]) || 0) + pointsFor(f, scoring[f.id], answers ? answers[f.id] : undefined));
    }
  });

  const fields = fieldsUpTo(pages, index);
  const calcs = wf && Array.isArray(wf.calcs) ? wf.calcs : [];
  calcs.forEach((c) => {
    if (!c || c.pageId !== page.id) return;
    const type = variableType(wf, c.variable);
    if (!type) return;
    if (!matches(c, wf, fields, { answers, hidden, vars: next }, true)) return;
    if (type === "text") {
      if (c.op === "set") next[c.variable] = String(c.value === undefined || c.value === null ? "" : c.value);
      return;
    }
    const n = Number(c.value);
    if (!Number.isFinite(n)) return;
    const cur = Number(next[c.variable]) || 0;
    if (c.op === "add") next[c.variable] = tidyNumber(cur + n);
    else if (c.op === "subtract") next[c.variable] = tidyNumber(cur - n);
    else if (c.op === "multiply") next[c.variable] = tidyNumber(cur * n);
    else if (c.op === "set") next[c.variable] = tidyNumber(n);
  });

  return next;
}

/** The variables after walking these pages, in this order. */
function varsAfter(pages, wf, trail, answers, hidden) {
  return (trail || []).reduce((vars, i) => applyPage(pages, wf, i, answers, hidden, vars), startVars(wf));
}

/* ------------------------------ following the path ------------------------------ */

/**
 * Where a target sends someone from page `from`: a later page's index, or
 * "end". Jumps may only go forward, so a form can never loop; a target
 * that is missing or behind is treated as "not set".
 */
function resolveTarget(pages, from, target) {
  if (target === "end") return "end";
  if (!target || target === "next") return null;
  const to = pages.findIndex((p) => p && p.id === target);
  return to > from ? to : null;
}

/**
 * The page after `pageIndex`: an index, or "end". `vars` are the variables
 * once this page's own points and calculations have run; `hidden` the
 * values from the link.
 */
function nextStep(pages, workflow, pageIndex, answers, hidden, vars) {
  const list = pages || [];
  const page = list[pageIndex];
  const cfg = page && workflow && workflow.pages ? workflow.pages[page.id] : null;

  if (cfg) {
    const fields = fieldsUpTo(list, pageIndex);
    const ctx = { answers, hidden: hidden || {}, vars: vars || startVars(workflow) };
    const rules = Array.isArray(cfg.rules) ? cfg.rules : [];
    for (let i = 0; i < rules.length; i += 1) {
      if (matches(rules[i], workflow, fields, ctx, false)) {
        const to = resolveTarget(list, pageIndex, rules[i].goTo);
        if (to !== null) return to;
      }
    }
    const fallback = resolveTarget(list, pageIndex, cfg.otherwise);
    if (fallback !== null) return fallback;
  }

  return pageIndex + 1 < list.length ? pageIndex + 1 : "end";
}

/**
 * The whole run for a set of answers: the pages walked, the variables and
 * score at the end, the tags earned and the ending to show.
 */
function run(pages, workflow, answers, hidden) {
  const list = pages || [];
  const h = hidden || {};
  const path = [];
  let vars = startVars(workflow);
  let at = list.length ? 0 : "end";
  while (at !== "end" && path.length <= list.length) {
    path.push(at);
    vars = applyPage(list, workflow, at, answers, h, vars);
    at = nextStep(list, workflow, at, answers, h, vars);
  }

  const fields = fieldsUpTo(list, -1);
  const ctx = { answers, hidden: h, vars };
  const tags = (workflow && Array.isArray(workflow.tags) ? workflow.tags : [])
    .filter((t) => t && t.name && matches(t, workflow, fields, ctx, true))
    .map((t) => t.name);
  const outcome =
    (workflow && Array.isArray(workflow.outcomes) ? workflow.outcomes : []).find(
      (o) => o && matches(o, workflow, fields, ctx, true)
    ) || null;

  return { path, vars, score: vars[SCORE], tags: [...new Set(tags)], outcome };
}

/** The pages someone with these answers walks through, in order, as indexes. */
function pathOf(pages, workflow, answers, hidden) {
  return run(pages, workflow, answers, hidden).path;
}

/**
 * Fills {{name}} in a piece of text with a hidden field or variable
 * ({{score}} included). Unknown names are left out. Always plain text —
 * the page shows it as text, never as HTML.
 */
function recall(text, hidden, vars) {
  if (typeof text !== "string" || text.indexOf("{{") === -1) return text;
  return text.replace(/\{\{\s*([a-z][a-z0-9_]{0,31})\s*\}\}/g, (_, name) => {
    if (vars && Object.prototype.hasOwnProperty.call(vars, name)) return String(vars[name]);
    if (hidden && Object.prototype.hasOwnProperty.call(hidden, name)) return String(hidden[name]);
    return "";
  });
}

export { OP_LABELS, OPS_BY_KIND, NO_VALUE, CALC_OPS, SCORE, NAME_RE, kindOf, choiceOptions, variableType, refOf, matches, startVars, applyPage, varsAfter, nextStep, run, pathOf, recall };