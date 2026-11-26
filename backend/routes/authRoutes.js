const express = require("express");
const { body } = require("express-validator");
const auth = require("../controllers/authController");
const { requireAuth } = require("../middleware/auth");
const { loginLimiter } = require("../middleware/security");

const router = express.Router();

const credentialRules = [
  body("email")
    .isString()
    .isLength({ max: 160 })
    .isEmail()
    .withMessage("Enter a valid email address."),
  body("password")
    .isString()
    .isLength({ min: 1, max: 200 })
    .withMessage("Enter your password."),
];

// Ten wrong passwords from one address and sign-in pauses for 15 minutes.
router.post("/user/login", loginLimiter, credentialRules, auth.userLogin);
router.get("/me", requireAuth, auth.me);

module.exports = router;