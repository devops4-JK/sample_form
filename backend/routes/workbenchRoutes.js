const express = require("express");
const ctrl = require("../controllers/workbenchController");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

// Workbenches are shared: any signed-in user may work with any of them.
router.use(requireAuth);

router.get("/", ctrl.list);
router.post("/", ctrl.create);
router.patch("/:id", ctrl.rename);
router.delete("/:id", ctrl.remove);

module.exports = router;