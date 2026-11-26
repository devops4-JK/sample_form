const express = require("express");
const ctrl = require("../controllers/themeController");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

// Themes are shared: any signed-in user may work with any of them.
router.use(requireAuth);

router.get("/", ctrl.list);
router.post("/", ctrl.create);

// Which theme a form wears. These sit above /:id so "form" is never read
// as a theme id.
router.get("/form/:formId", ctrl.forForm);
router.put("/form/:formId", ctrl.applyToForm);
router.put("/form/:formId/publish", ctrl.publishForForm);

router.patch("/:id", ctrl.update);
router.delete("/:id", ctrl.remove);

module.exports = router;