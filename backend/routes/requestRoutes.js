const express = require("express");
const ctrl = require("../controllers/requestController");
const { requireAuth, requireAdmin } = require("../middleware/auth");

const router = express.Router();

router.use(requireAuth);

// ---- admin ----
// These sit above /:id so that "all" is not read as an id.
router.get("/all", requireAdmin, ctrl.listAll);
router.patch("/:id/decision", requireAdmin, ctrl.decide);
router.delete("/:id/admin", requireAdmin, ctrl.remove);

// ---- user ----
router.post("/", ctrl.create);
router.get("/mine", ctrl.listMine);
router.get("/:id", ctrl.getOne);
router.delete("/:id", ctrl.withdraw);

module.exports = router;
