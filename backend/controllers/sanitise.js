/**
 * Checks on what comes in from a browser before it is stored.
 *
 * The builder and the public form both validate in the page, but a page can
 * be bypassed: anyone can send a request by hand. These are the same rules
 * applied again on the server, where they cannot be skipped.
 */

const { DISPLAY_ONLY, pagesOf } = require("./formSchema");
const { run, recall } = require("../workflow/engine");
const { cleanHidden, isActive } = require("../workflow/clean");

/* ------------------------------ limits ------------------------------ */

const MAX_PAGES = 100;
const MAX_FIELDS_PER_PAGE = 200;
const MAX_TEXT = 5000; // one typed answer
const MAX_ITEMS = 100; // choices ticked, rows ranked
const MAX_PARTS = 50; // sub-fields in an address, rows in a matrix

/* --------------------------- pictures, links --------------------------- */

/** Keys on a page or a screen that hold a picture. */
const MEDIA_KEYS = ["image", "imageMobile", "background", "backgroundMobile"];

/**
 * A picture is either a file read in the browser (a data: URL of an image
 * or a video) or a plain web address. Anything else — a javascript: link,
 * a file: path — is dropped rather than stored and served to respondents.
 */
function isSafeMedia(value) {
  if (value === "" || value === null || value === undefined) return true;
  if (typeof value !== "string") return false;
  return /^data:(image|video)\/[a-z0-9.+-]+[;,]/i.test(value) || /^https?:\/\//i.test(value);
}

const isHttpUrl = (value) => typeof value === "string" && /^https?:\/\/[^\s]+$/i.test(value.trim());

const fail = (message) => {
  const err = new Error(message);
  err.status = 400;
  err.expose = true;
  return err;
};

/**
 * Checks a form's schema as the builder saves it. Structural problems are
 * refused outright; an unsafe picture or link is quietly emptied, so one
 * bad value never costs someone the rest of their work.
 *
 * Returns the schema to store. Throws a 400 with a readable message.
 */
function sanitiseSchema(schema) {
  if (schema === null) return null;
  if (typeof schema !== "object" || Array.isArray(schema)) {
    throw fail("The form could not be saved: it is not in the expected shape.");
  }

  const pages = pagesOf(schema);
  if (pages.length > MAX_PAGES) {
    throw fail(`A form can hold up to ${MAX_PAGES} pages.`);
  }

  const seen = new Set();

  const cleanOwner = (owner) => {
    MEDIA_KEYS.forEach((key) => {
      if (key in owner && !isSafeMedia(owner[key])) owner[key] = "";
    });
  };

  pages.forEach((page) => {
    if (!page || typeof page !== "object" || Array.isArray(page)) {
      throw fail("The form could not be saved: one of its pages is not in the expected shape.");
    }
    if (page.fields !== undefined && !Array.isArray(page.fields)) {
      throw fail("The form could not be saved: one of its pages is not in the expected shape.");
    }
    if ((page.fields || []).length > MAX_FIELDS_PER_PAGE) {
      throw fail(`A page can hold up to ${MAX_FIELDS_PER_PAGE} items.`);
    }
    cleanOwner(page);

    (page.fields || []).forEach((field) => {
      if (!field || typeof field !== "object" || Array.isArray(field)) {
        throw fail("The form could not be saved: one of its questions is not in the expected shape.");
      }
      if (typeof field.id !== "string" || !/^[\w-]{1,64}$/.test(field.id)) {
        throw fail("The form could not be saved: a question is missing its id.");
      }
      if (typeof field.type !== "string" || !/^[a-z_]{1,40}$/.test(field.type)) {
        throw fail("The form could not be saved: a question has an unknown type.");
      }
      if (seen.has(field.id)) {
        throw fail("The form could not be saved: two questions share one id.");
      }
      seen.add(field.id);

      cleanOwner(field);
      if (Array.isArray(field.images)) {
        field.images = field.images.map((src) => (isSafeMedia(src) ? src : ""));
      }
      // Product pictures, in a single product question and in every set.
      const cleanProducts = (list) =>
        Array.isArray(list)
          ? list.forEach((p) => {
              if (p && typeof p === "object" && !isSafeMedia(p.image)) p.image = "";
            })
          : undefined;
      cleanProducts(field.products);
      if (Array.isArray(field.groups)) field.groups.forEach((g) => cleanProducts(g?.products));

      // Where a redirect sends people: a real web address or nothing.
      if ("url" in field && field.url && !isHttpUrl(field.url)) field.url = "";
    });
  });

  return schema;
}

/* ------------------------------ answers ------------------------------ */

const UNSAFE_KEYS = new Set(["__proto__", "constructor", "prototype"]);

const cleanText = (value, max = MAX_TEXT) => String(value).slice(0, max);

/** One value inside a list or a block: text or a number, nothing deeper. */
function cleanScalar(value, max) {
  if (typeof value === "string") return cleanText(value, max);
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "boolean") return value;
  return undefined;
}

/** A whole answer: text, a number, a list of choices, or a block of parts. */
function cleanAnswer(value) {
  const scalar = cleanScalar(value, MAX_TEXT);
  if (scalar !== undefined) return scalar;

  if (Array.isArray(value)) {
    return value
      .slice(0, MAX_ITEMS)
      .map((item) => cleanScalar(item, 500))
      .filter((item) => item !== undefined);
  }

  if (value && typeof value === "object") {
    const out = {};
    Object.keys(value)
      .slice(0, MAX_PARTS)
      .forEach((key) => {
        if (UNSAFE_KEYS.has(key)) return;
        const part = cleanScalar(value[key], 2000);
        if (part !== undefined) out[cleanText(key, 200)] = part;
      });
    return out;
  }

  return undefined;
}

/* ------------------------------ products ------------------------------ */

const SIZE_PRESETS = {
  apparel: ["S", "M", "L", "XL", "2XL", "3XL"],
  pants: ["28", "30", "32", "34", "36", "38", "40", "42", "44", "46"],
};

/** The sizes a product is offered in — the same rule as the page. */
function sizesOf(product) {
  if (!product || !product.sizeKind || product.sizeKind === "none") return [];
  if (product.sizeKind === "custom") {
    return (Array.isArray(product.sizes) ? product.sizes : []).map((x) => String(x).trim()).filter(Boolean);
  }
  return SIZE_PRESETS[product.sizeKind] || [];
}

const findProduct = (products, name) =>
  (Array.isArray(products) ? products : []).find((p) => p && p.name === name) || null;

/**
 * A product answer, rebuilt from the form's own products: a product that
 * is not on the form, or a size that product does not come in, is dropped
 * rather than stored. Returns { value, problem }.
 */
function cleanProductAnswer(field, raw, completed) {
  const label = field.label ? String(field.label).slice(0, 120) : "A product question";
  const given = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};

  if (field.type === "product_choice") {
    const chosen = findProduct(field.products, given.product);
    if (!chosen) {
      return { value: undefined, problem: field.required && completed ? `${label}: choose a product.` : null };
    }
    const sizes = sizesOf(chosen);
    const size = sizes.includes(given.size) ? given.size : "";
    const value = { product: chosen.name };
    if (sizes.length) value.size = size;
    const problem = sizes.length && !size && completed ? `${label}: choose a size for ${chosen.name}.` : null;
    return { value, problem };
  }

  // product_sets: one pick from every set
  const value = {};
  let problem = null;
  (Array.isArray(field.groups) ? field.groups : []).forEach((g) => {
    if (!g || typeof g.id !== "string") return;
    const chosen = findProduct(g.products, given[g.id]);
    if (!chosen) {
      if (field.required && completed && !problem) {
        problem = `${label}: choose one product in ${g.title || "every option"}.`;
      }
      return;
    }
    value[g.id] = chosen.name;
    const sizes = sizesOf(chosen);
    if (sizes.length) {
      const size = sizes.includes(given[`${g.id}:size`]) ? given[`${g.id}:size`] : "";
      value[`${g.id}:size`] = size;
      if (!size && completed && !problem) problem = `${label}: choose a size for ${chosen.name}.`;
    }
  });
  return { value: Object.keys(value).length ? value : undefined, problem };
}

/** The same "was this left blank?" the public page uses. */
const isEmpty = (value) =>
  value === undefined ||
  value === null ||
  value === "" ||
  (Array.isArray(value) && value.length === 0) ||
  (typeof value === "object" &&
    !Array.isArray(value) &&
    Object.values(value).filter(Boolean).length === 0);

/**
 * Turns what a respondent sent into what is stored.
 *
 * Only answers to questions that are really on the form are kept, each cut
 * down to a sensible size and to plain text, numbers and lists. When the
 * form was finished (rather than saved partway), every question marked
 * Required must have an answer.
 *
 * With a workflow, the server walks the logic jumps itself from the
 * answers given, the same way the page did. Only pages on that path count:
 * a Required question on a page the respondent was sent past cannot be
 * required, and anything sent for a skipped page is dropped, so a
 * tampered request cannot fill in questions nobody was shown.
 *
 * The same walk gives the run's results — values from the link, variables,
 * score, tags and ending — worked out here rather than taken from the page.
 *
 * Returns { answers, meta } or { error } with a message for the respondent.
 * `meta` is null for a form with no workflow.
 */
function sanitiseAnswers(schema, raw, { completed = true, workflow = null, hidden = null } = {}) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { error: "No answers were sent." };
  }

  const pages = pagesOf(schema);

  /* One page's answers, cleaned. `strict` turns the Required checks on;
     it is off while working out the path, on for the pages walked. */
  const cleanPage = (page, into, strict) => {
    let problem = null;
    (page.fields || []).forEach((field) => {
      if (!field || DISPLAY_ONLY.has(field.type)) return;

      const given = Object.prototype.hasOwnProperty.call(raw, field.id) ? raw[field.id] : undefined;

      // Products are rebuilt from the form's own products and sizes.
      if (field.type === "product_choice" || field.type === "product_sets") {
        const result = cleanProductAnswer(field, given, strict);
        if (result.value !== undefined) into[field.id] = result.value;
        if (result.problem && !problem) problem = result.problem;
        return;
      }

      const value = given === undefined ? undefined : cleanAnswer(given);

      if (value !== undefined && !isEmpty(value)) {
        into[field.id] = value;
      } else if (field.required && strict && !problem) {
        const label = field.label ? String(field.label).slice(0, 120) : "A required question";
        problem = `${label} is required.`;
      }
    });
    return problem;
  };

  // Which pages were really on this respondent's way through.
  let visited = pages.map((_, i) => i);
  const active = isActive(workflow);
  const link = active ? cleanHidden(workflow, hidden) : {};
  if (active) {
    const draft = {};
    pages.forEach((page) => cleanPage(page, draft, false));
    visited = run(pages, workflow, draft, link).path;
  }

  const answers = {};
  let problem = null; // the first thing that stops the form being finished
  visited.forEach((i) => {
    const found = cleanPage(pages[i], answers, completed);
    if (found && !problem) problem = found;
  });

  if (problem) return { error: problem };
  if (!active) return { answers, meta: null };

  // Worked out again from the answers actually kept.
  const result = run(pages, workflow, answers, link);
  const meta = {
    hidden: link,
    vars: result.vars,
    score: result.score,
    tags: result.tags,
    // The ending's title as the respondent saw it, {{names}} filled in.
    outcome: result.outcome
      ? { id: result.outcome.id, title: recall(result.outcome.title || "", link, result.vars) }
      : null,
  };
  return { answers, meta, outcome: result.outcome };
}

/* ----------------------------- passwords ----------------------------- */

/**
 * Why a password is not good enough, or null when it is. bcrypt only reads
 * the first 72 bytes, so anything longer would be silently cut short.
 */
function passwordProblem(password) {
  const text = typeof password === "string" ? password : "";
  if (text.length < 8) return "Password must be at least 8 characters.";
  if (Buffer.byteLength(text, "utf8") > 72) return "Password must be 72 characters or fewer.";
  if (!/[A-Za-z]/.test(text) || !/[0-9]/.test(text)) {
    return "Password must contain at least one letter and one number.";
  }
  return null;
}

module.exports = {
  MEDIA_KEYS,
  isSafeMedia,
  sanitiseSchema,
  sanitiseAnswers,
  passwordProblem,
};