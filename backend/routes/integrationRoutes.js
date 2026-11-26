const express = require("express");
const integrations = require("../controllers/integrationController");
const { feedLimiter } = require("../middleware/security");

const router = express.Router();

// Public on purpose: Excel cannot log in. The token in the URL is the key,
// and disconnecting in the Connect tab switches the link off for good.
// XLSX only.
router.get("/excel/:token.xlsx", feedLimiter, integrations.publicFeed);

module.exports = router;