const express = require("express");

const router = express.Router();

router.get("/health", (req, res) => res.json({ status: "ok" }));
router.use("/auth", require("./authRoutes"));
router.use("/workbenches", require("./workbenchRoutes"));
router.use("/forms", require("./formRoutes"));
router.use("/themes", require("./themeRoutes"));
router.use("/integrations", require("./integrationRoutes"));

module.exports = router;