require("dotenv").config();
const express = require("express");
const cors = require("cors");

const security = require("./middleware/security");

/* Checked before anything else is loaded: a missing or weak secret should
   stop the server, not surface later as a confusing login error. */
const { problems, warnings } = security.checkEnvironment();
warnings.forEach((w) => console.warn(`Security warning: ${w}`));
if (problems.length) {
  problems.forEach((p) => console.error(`Cannot start: ${p}`));
  process.exit(1);
}

const routes = require("./routes");
const { notFound, errorHandler } = require("./middleware/errorHandler");
const { sequelize } = require("./models");

const app = express();
const PORT = process.env.PORT || 5000;

/* Behind nginx, a load balancer or a hosting platform, set TRUST_PROXY=1 so
   rate limits count the visitor's address and not the proxy's. Leave it
   unset when the server is reached directly. */
if (process.env.TRUST_PROXY) {
  const hops = Number(process.env.TRUST_PROXY);
  app.set("trust proxy", Number.isFinite(hops) ? hops : process.env.TRUST_PROXY);
}

app.disable("x-powered-by");
app.use(security.headers);
app.use(cors(security.corsOptions));

/* Counted before any body is read, so a flood is turned away cheaply. */
app.use("/api", security.apiLimiter);

/* Body size depends on the route: see middleware/security.js. */
app.use(security.bodyParsers());

/* ?a=1&a=2 arrives as a plain string, not an array a handler never expected. */
app.use(security.hpp);

app.use("/api", security.noStore, routes);
app.use(notFound);
app.use(errorHandler);

async function start() {
  try {
    await sequelize.authenticate();
    // Creates tables on first run. Swap for migrations before production.
    await sequelize.sync();
    console.log("Database connected.");
  } catch (err) {
    console.error("Database connection failed:", err.message);
    process.exit(1);
  }

  app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));

  // Keeps linked Google Sheets in step. Does nothing until a service
  // account key is set in .env.
  require("./sheets/sync").start();
}

start();