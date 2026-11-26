const express = require("express");
const ctrl = require("../controllers/formController");
const integrations = require("../controllers/integrationController");
const sheet = require("../sheets/controller");
const { requireAuth } = require("../middleware/auth");
const { gateLimiter, publicFormLimiter } = require("../middleware/security");

const router = express.Router();

// Public share link. Must sit above requireAuth.
// Each is rate limited, since anyone on the internet can reach them.
router.get("/public/:publicId", publicFormLimiter, ctrl.getPublic);
router.post("/public/:publicId", publicFormLimiter, ctrl.submitPublic);
// The validation gate: an address asking to be let in to a gated form.
// Limited harder, so nobody can try addresses to learn who is on a list.
router.post("/public/:publicId/sign-in", gateLimiter, ctrl.signInPublic);

router.use(requireAuth);

// Who may fill this form in — the Validation tab.
router.use("/:id/validation", require("../validation").routes);

// Logic jumps between pages — the Workflow tab.
router.use("/:id/workflow", require("../workflow").routes);

router.get("/", ctrl.list);
router.post("/", ctrl.create);
router.get("/:id", ctrl.getOne);
router.patch("/:id", ctrl.update);
router.patch("/:id/move", ctrl.move);
router.get("/:id/responses", ctrl.responses);
router.get("/:id/questions", ctrl.questions);

// ---- Excel ----
router.get("/:id/integrations", integrations.status);
router.post("/:id/integrations/excel", integrations.enableExcel);
router.delete("/:id/integrations/excel", integrations.disableExcel);
router.get("/:id/export.xlsx", integrations.downloadXlsx);
router.get("/:id/export.csv", integrations.downloadCsv);

// ---- Google Sheets: a sheet kept in step with the form, both ways ----
router.get("/:id/sheet", sheet.status);
router.put("/:id/sheet", sheet.connect);
router.post("/:id/sheet/sync", sheet.syncNow);
router.delete("/:id/sheet", sheet.disconnect);
router.delete("/:id", ctrl.remove);

module.exports = router;