const express = require("express");
const ctrl = require("./controller");

/**
 * Mounted inside the form routes, under /api/forms/:id/validation, and
 * therefore already behind requireAuth. mergeParams keeps :id readable
 * from in here.
 *
 * The public side has no routes of its own: signing in happens on the
 * form's own public link, next to the form it opens.
 */
const router = express.Router({ mergeParams: true });

router.get("/", ctrl.get);
router.patch("/", ctrl.update);

router.post("/entries", ctrl.addEntries);

// An uploaded .xlsx customer list. Sent as the raw file, not as JSON, so it
// has a parser and a size limit of its own: a list of addresses is small.
router.post(
  "/import",
  express.raw({ type: () => true, limit: "5mb" }),
  ctrl.importSheet
);
router.delete("/entries", ctrl.clearEntries);
router.delete("/entries/:entryId", ctrl.removeEntry);
router.post("/entries/:entryId/reset", ctrl.resetEntry);

module.exports = router;