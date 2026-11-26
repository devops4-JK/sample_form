const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { validationResult } = require("express-validator");
const { User } = require("../models");

function signToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET,
    { algorithm: "HS256", expiresIn: process.env.JWT_EXPIRES_IN || "1d" }
  );
}

/* Compared against when no account matches, so "no such email" takes as
   long to answer as "wrong password" and timing gives nothing away. */
const DUMMY_HASH = bcrypt.hashSync("no-such-account", 10);

function firstValidationError(req) {
  const errors = validationResult(req);
  return errors.isEmpty() ? null : errors.array()[0].msg;
}

/**
 * Login handler. Only user accounts can sign in; any old admin accounts
 * left in the database are refused, with the same message as a wrong
 * password.
 */
async function login(req, res, next, expectedRole) {
  try {
    const invalid = firstValidationError(req);
    if (invalid) return res.status(400).json({ message: invalid });

    const email = String(req.body.email).trim().toLowerCase();
    const user = await User.findOne({ where: { email } });

    // Same message for "no such user" and "wrong password" so the response
    // cannot be used to discover which emails exist.
    const rejection = { message: "Email or password is incorrect." };
    const ok = await bcrypt.compare(
      String(req.body.password),
      user ? user.passwordHash : DUMMY_HASH
    );
    if (!user || !ok) return res.status(401).json(rejection);

    if (user.role !== expectedRole) return res.status(401).json(rejection);

    if (!user.isActive) {
      return res.status(403).json({
        message:
          "Your account is switched off. Ask your IT team to turn it back on.",
      });
    }

    user.lastLoginAt = new Date();
    await user.save();

    return res.json({ token: signToken(user), user: user.toSafeJSON() });
  } catch (err) {
    return next(err);
  }
}

exports.userLogin = (req, res, next) => login(req, res, next, "user");

/** Returns the logged-in account, used to restore a session on page refresh. */
exports.me = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ message: "Account not found." });
    return res.json({ user: user.toSafeJSON() });
  } catch (err) {
    return next(err);
  }
};