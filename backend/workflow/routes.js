const express = require("express");
const ctrl = require("./controller");
const auto = require("./automationController");

/**
 * Mounted inside the form routes, under /api/forms/:id/workflow, and
 * therefore already behind requireAuth. mergeParams keeps :id readable.
 *
 * The public side has no routes of its own: the public form receives the
 * workflow alongside its pages, and the server re-walks it on submit.
 */
const router = express.Router({ mergeParams: true });

router.get("/", ctrl.get);
router.put("/", ctrl.save);

// Webhook and email after a submission.
router.get("/automations", auto.get);
router.put("/automations", auto.save);
router.post("/automations/secret", auto.newSecret);
router.post("/automations/test", auto.test);

module.exports = router;