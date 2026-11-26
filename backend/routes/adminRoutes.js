const express = require("express");
const admin = require("../controllers/adminController");
const { requireAuth, requireAdmin } = require("../middleware/auth");

const router = express.Router();

// Everything below this line requires a valid token AND the admin role.
router.use(requireAuth, requireAdmin);

router.get("/overview", admin.overview);

router.get("/users", admin.listUsers);
router.post("/users", admin.createUser);
router.patch("/users/:id", admin.updateUser);
router.patch("/users/:id/access", admin.setUserAccess);
router.patch("/users/:id/password", admin.resetUserPassword);
router.delete("/users/:id", admin.deleteUser);

module.exports = router;