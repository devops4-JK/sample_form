const express = require("express");
const helmet = require("helmet");
const hpp = require("hpp");
const { rateLimit } = require("express-rate-limit");

/**
 * Everything that hardens the API, in one place, so server.js reads as a
 * list of what is switched on.
 *
 *   headers      helmet: no sniffing, no framing, HSTS, no referrer leaks
 *   CORS         only the origins named in CLIENT_URL may call from a browser
 *   body sizes   small by default; only the routes that carry pictures get room
 *   rate limits  logins, the public form, the Excel link and the API as a whole
 *   no caching   answers and account data are never stored by a browser or proxy
 *
 * Every number can be changed from .env without touching code; the defaults
 * are sized for an office where many people share one internet address.
 */

const num = (name, fallback) => {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

/* ------------------------------ headers ------------------------------ */

/* The API only ever answers with JSON or a spreadsheet, never a page, so
   the strictest content policy costs nothing: nothing it returns may load
   or run anything. */
const headers = helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'none'"],
      formAction: ["'none'"],
    },
  },
  // The frontend lives on another origin and reads these responses.
  crossOriginResourcePolicy: { policy: "cross-origin" },
  referrerPolicy: { policy: "no-referrer" },
});

/** Nothing the API returns should sit in a browser or proxy cache. */
function noStore(req, res, next) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
  next();
}

/* ------------------------------- CORS ------------------------------- */

/** CLIENT_URL may hold one origin or several, separated by commas. */
const allowedOrigins = String(process.env.CLIENT_URL || "http://localhost:3000")
  .split(",")
  .map((s) => s.trim().replace(/\/$/, ""))
  .filter(Boolean);

const corsOptions = {
  origin(origin, done) {
    /* No Origin header means it is not a browser calling across sites:
       Excel pulling its link, curl, a health check. CORS has nothing to
       say about those. A browser on an origin that is not on the list gets
       no CORS headers back, so it refuses to hand the response over. */
    if (!origin) return done(null, true);
    return done(null, allowedOrigins.includes(origin.replace(/\/$/, "")));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
  exposedHeaders: ["Content-Disposition"],
  maxAge: 600,
};

/* ---------------------------- body sizes ---------------------------- */

/**
 * Pictures chosen in the builder and the Design section travel inside the
 * JSON as data URLs, so signed-in saves need real room. Nothing else does:
 * a login is two short strings and a public submission is plain answers,
 * and neither should be able to make the server parse megabytes.
 *
 * express.json() skips a request whose body is already parsed, so the
 * tight limits are mounted first on their own paths and the roomy one
 * catches whatever is left.
 */
function bodyParsers() {
  const router = express.Router();
  router.use("/api/auth", express.json({ limit: "10kb" }));
  router.use("/api/forms/public", express.json({ limit: process.env.PUBLIC_BODY_LIMIT || "1mb" }));
  router.use(express.json({ limit: process.env.BODY_LIMIT || "40mb" }));
  return router;
}

/* ---------------------------- rate limits ---------------------------- */

const limiter = (windowMs, limit, message, extra = {}) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { message },
    ...extra,
  });

const MIN = 60 * 1000;

/** Guessing passwords: only failed attempts count towards the limit. */
const loginLimiter = limiter(
  15 * MIN,
  num("RATE_LOGIN", 10),
  "Too many sign-in attempts. Wait 15 minutes and try again.",
  { skipSuccessfulRequests: true }
);

/** Opening and submitting a published form. Many people share an office IP. */
const publicFormLimiter = limiter(
  MIN,
  num("RATE_PUBLIC", 300),
  "Too many requests from this network. Wait a minute and try again."
);

/** The validation gate: slows anyone trying addresses to see who is listed. */
const gateLimiter = limiter(
  MIN,
  num("RATE_GATE", 30),
  "Too many sign-in attempts. Wait a minute and try again."
);

/** The Excel link: a workbook refresh, not a download loop. */
const feedLimiter = limiter(
  MIN,
  num("RATE_FEED", 30),
  "This link is being pulled too often. Wait a minute and refresh again."
);

/** Everything else. The builder autosaves, so this is generous. */
const apiLimiter = limiter(
  MIN,
  num("RATE_API", 600),
  "Too many requests. Wait a minute and try again."
);

/* ------------------------- start-up checks ------------------------- */

/**
 * Refuses to start with settings that would leave the app open. Returns
 * a list of warnings for things that are only acceptable while developing.
 */
function checkEnvironment() {
  const production = process.env.NODE_ENV === "production";
  const problems = [];
  const warnings = [];

  const secret = process.env.JWT_SECRET || "";
  if (!secret) {
    problems.push("JWT_SECRET is not set. Sign-in cannot work without it.");
  } else if (secret.length < 32) {
    (production ? problems : warnings).push(
      "JWT_SECRET is shorter than 32 characters. Use a long random value: " +
        "node -e \"console.log(require('crypto').randomBytes(48).toString('hex'))\""
    );
  }

  ["DB_NAME", "DB_USER", "DB_HOST"].forEach((key) => {
    if (!process.env[key]) problems.push(`${key} is not set.`);
  });

  if (production && !process.env.CLIENT_URL) {
    problems.push("CLIENT_URL is not set. It names the website allowed to call this API.");
  }
  if (production && allowedOrigins.some((o) => o.startsWith("http://"))) {
    warnings.push("CLIENT_URL uses http://. Serve the site over https:// in production.");
  }

  return { problems, warnings };
}

module.exports = {
  headers,
  hpp: hpp(),
  noStore,
  corsOptions,
  bodyParsers,
  loginLimiter,
  publicFormLimiter,
  gateLimiter,
  feedLimiter,
  apiLimiter,
  checkEnvironment,
};