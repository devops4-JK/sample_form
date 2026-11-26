const { OPS_BY_KIND, NO_VALUE, CALC_OPS, SCORE, NAME_RE, kindOf, choiceOptions } = require("./engine");

/**
 * Never stores a workflow as sent. Everything is rebuilt from scratch: only
 * pages and questions that exist on the form, only known comparisons and
 * calculations, capped sizes and counts, plain strings. Anything else is
 * dropped without a fuss.
 */

const LIMITS = {
  rulesPerPage: 20,
  conditionsPerRule: 10,
  valueLength: 200,
  hidden: 20,
  variables: 20,
  calcs: 100,
  tags: 50,
  outcomes: 20,
  pointsPerQuestion: 100,
  maxPoints: 1000000,
  titleLength: 120,
  messageLength: 1000,
  urlLength: 500,
};

const ALL_OPS = new Set(Object.values(OPS_BY_KIND).flat());
const ID = /^[A-Za-z0-9_-]{1,64}$/;

const pagesOf = (schema) => (schema && Array.isArray(schema.pages) ? schema.pages : []);
const arr = (v) => (Array.isArray(v) ? v : []);
const obj = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : {});

/** Plain text: control characters out, trimmed, capped. */
const text = (v, max) =>
  String(v === undefined || v === null ? "" : v)
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim()
    .slice(0, max);

const clampNumber = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(-LIMITS.maxPoints, Math.min(LIMITS.maxPoints, Math.round(n * 10000) / 10000));
};

/** An http(s) address for an ending's redirect, or "". {{names}} are allowed. */
function cleanUrl(v) {
  const s = text(v, LIMITS.urlLength);
  if (!s) return "";
  const probe = s.replace(/\{\{\s*[a-z][a-z0-9_]{0,31}\s*\}\}/g, "x");
  try {
    const u = new URL(probe);
    return u.protocol === "https:" || u.protocol === "http:" ? s : "";
  } catch (_) {
    return "";
  }
}

const newId = (prefix, i) => `${prefix}${i + 1}`;
const keepId = (v, prefix, i) => (typeof v === "string" && ID.test(v) ? v : newId(prefix, i));

/** One list of conditions. `allowed(ref)` says which references may be used. */
function cleanConditions(list, allowed) {
  return arr(list)
    .slice(0, LIMITS.conditionsPerRule)
    .filter((c) => c && typeof c === "object")
    .map((c) => {
      const ref = typeof c.fieldId === "string" && c.fieldId.length <= 80 && allowed(c.fieldId) ? c.fieldId : "";
      const op = ALL_OPS.has(c.op) ? c.op : "is";
      return {
        fieldId: ref,
        op,
        value: NO_VALUE.has(op) ? "" : text(c.value, LIMITS.valueLength),
      };
    });
}

/** A jump target: "end", or a page id that comes after `index`. */
function cleanTarget(target, pageIds, index, allowNext) {
  if (target === "end") return "end";
  if (allowNext && (target === "next" || !target)) return "next";
  if (typeof target !== "string" || !ID.test(target)) return null;
  const to = pageIds.indexOf(target);
  return to > index ? target : null;
}

function cleanWorkflow(schema, raw) {
  const given = obj(raw);
  const pages = pagesOf(schema);
  const pageIds = pages.map((p) => (p && p.id) || "");

  /* ---- hidden fields and variables come first: conditions may use them ---- */
  const names = new Set([SCORE]);
  const hidden = [];
  arr(given.hidden).forEach((h) => {
    const key = text(obj(h).key, 32).toLowerCase();
    if (hidden.length < LIMITS.hidden && NAME_RE.test(key) && !names.has(key)) {
      names.add(key);
      hidden.push({ key });
    }
  });

  const variables = [];
  arr(given.variables).forEach((v) => {
    const o = obj(v);
    const name = text(o.name, 32).toLowerCase();
    if (variables.length >= LIMITS.variables || !NAME_RE.test(name) || names.has(name)) return;
    names.add(name);
    const type = o.type === "text" ? "text" : "number";
    variables.push({ name, type, initial: type === "text" ? text(o.initial, LIMITS.valueLength) : clampNumber(o.initial) });
  });

  const hiddenKeys = new Set(hidden.map((h) => h.key));
  const varNames = new Set([SCORE, ...variables.map((v) => v.name)]);
  const varType = (n) => (n === SCORE ? "number" : (variables.find((v) => v.name === n) || {}).type || null);

  // Questions on pages up to `index` (all pages when index is -1), by id.
  const fieldsUpTo = (index) => {
    const out = {};
    pages.slice(0, index < 0 ? pages.length : index + 1).forEach((p) =>
      arr(p && p.fields).forEach((f) => f && f.id && kindOf(f) && (out[f.id] = f))
    );
    return out;
  };
  const allFields = fieldsUpTo(-1);

  const allowedFor = (fields) => (ref) => {
    if (ref.startsWith("hidden:")) return hiddenKeys.has(ref.slice(7));
    if (ref.startsWith("var:")) return varNames.has(ref.slice(4));
    return ID.test(ref) && Boolean(fields[ref]);
  };

  /* ---- logic jumps ---- */
  const outPages = {};
  const givenPages = obj(given.pages);
  pages.forEach((page, index) => {
    if (!page || !page.id || !Object.prototype.hasOwnProperty.call(givenPages, page.id)) return;
    const cfg = obj(givenPages[page.id]);
    const allowed = allowedFor(fieldsUpTo(index));
    const rules = arr(cfg.rules)
      .slice(0, LIMITS.rulesPerPage)
      .filter((r) => r && typeof r === "object")
      .map((rule, i) => ({
        id: keepId(rule.id, "r", i),
        match: rule.match === "any" ? "any" : "all",
        conditions: cleanConditions(rule.conditions, allowed),
        goTo: cleanTarget(rule.goTo, pageIds, index, false) || "",
      }));
    const otherwise = cleanTarget(cfg.otherwise, pageIds, index, true) || "next";
    if (rules.length || otherwise !== "next") outPages[page.id] = { rules, otherwise };
  });

  /* ---- points per answer ---- */
  const scoring = {};
  Object.entries(obj(given.scoring)).forEach(([fieldId, rule]) => {
    const field = allFields[fieldId];
    const kind = kindOf(field);
    if (!field || (kind !== "choice" && kind !== "number")) return;
    const r = obj(rule);
    const options = new Set(choiceOptions(field));
    const points = {};
    Object.entries(obj(r.points))
      .slice(0, LIMITS.pointsPerQuestion)
      .forEach(([option, p]) => {
        const n = clampNumber(p);
        if (options.has(option) && n !== 0) points[option] = n;
      });
    const addAnswer = kind === "number" && r.addAnswer === true;
    if (Object.keys(points).length || addAnswer) scoring[fieldId] = { points, addAnswer };
  });

  /* ---- calculations ---- */
  const calcs = arr(given.calcs)
    .slice(0, LIMITS.calcs)
    .filter((c) => c && typeof c === "object")
    .map((c, i) => {
      const index = pageIds.indexOf(c.pageId);
      if (index < 0) return null;
      const type = varType(c.variable);
      const op = type === "text" ? "set" : Object.prototype.hasOwnProperty.call(CALC_OPS, c.op) ? c.op : "add";
      return {
        id: keepId(c.id, "c", i),
        pageId: c.pageId,
        match: c.match === "any" ? "any" : "all",
        conditions: cleanConditions(c.conditions, allowedFor(fieldsUpTo(index))),
        variable: type ? c.variable : "",
        op,
        value: type === "number" ? String(clampNumber(c.value)) : text(c.value, LIMITS.valueLength),
      };
    })
    .filter(Boolean);

  /* ---- tags and endings: they may look at everything ---- */
  const allowedAll = allowedFor(allFields);

  const tags = arr(given.tags)
    .slice(0, LIMITS.tags)
    .filter((t) => t && typeof t === "object")
    .map((t, i) => ({
      id: keepId(t.id, "t", i),
      name: text(t.name, 40).replace(/[^\p{L}\p{N} _\-]/gu, ""),
      match: t.match === "any" ? "any" : "all",
      conditions: cleanConditions(t.conditions, allowedAll),
    }));

  const outcomes = arr(given.outcomes)
    .slice(0, LIMITS.outcomes)
    .filter((o) => o && typeof o === "object")
    .map((o, i) => ({
      id: keepId(o.id, "o", i),
      title: text(o.title, LIMITS.titleLength),
      message: text(o.message, LIMITS.messageLength),
      redirect: cleanUrl(o.redirect),
      match: o.match === "any" ? "any" : "all",
      conditions: cleanConditions(o.conditions, allowedAll),
    }));

  return { pages: outPages, hidden, variables, scoring, calcs, tags, outcomes };
}

/**
 * What the public link is sent: everything the page needs to walk the form
 * and show the right ending. Tags are left out — they are for the team.
 */
function publicWorkflow(wf) {
  const { tags, ...rest } = wf || {};
  return rest;
}

/** Is there anything in this workflow beyond plain page-by-page? */
function isActive(wf) {
  const w = wf || {};
  return Boolean(
    Object.keys(w.pages || {}).length ||
      (w.hidden || []).length ||
      (w.variables || []).length ||
      Object.keys(w.scoring || {}).length ||
      (w.calcs || []).length ||
      (w.tags || []).length ||
      (w.outcomes || []).length
  );
}

/** Values that came in on the link: only declared keys, as short plain text. */
function cleanHidden(wf, raw) {
  const given = obj(raw);
  const out = {};
  ((wf && wf.hidden) || []).forEach((h) => {
    if (Object.prototype.hasOwnProperty.call(given, h.key)) {
      const v = text(given[h.key], 500);
      if (v) out[h.key] = v;
    }
  });
  return out;
}

module.exports = { cleanWorkflow, publicWorkflow, cleanHidden, isActive, cleanUrl, LIMITS };