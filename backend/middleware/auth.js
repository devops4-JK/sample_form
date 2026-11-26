const jwt = require("jsonwebtoken");
const { User } = require("../models");

/**
 * Reads the Bearer token and attaches { id, role } to req.user.
 *
 * The token alone is not enough. It stays valid for a day, and in that day
 * the account may be switched off or removed (npm run users -- disable …).
 * So every request looks the account up again and goes by what the
 * database says now, not by what the token said when it was issued:
 * switching someone off locks them out at their next click. Only user
 * accounts get in; old admin accounts are refused.
 */
async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: "You need to log in first." });
  }

  let claims;
  try {
    // Pinned to the one algorithm the app signs with.
    claims = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
  } catch (err) {
    return res
      .status(401)
      .json({ message: "Your session has expired. Log in again." });
  }

  try {
    const user = await User.findByPk(claims.id, { attributes: ["id", "role", "isActive"] });

    if (!user || !user.isActive || user.role !== "user") {
      return res
        .status(401)
        .json({ message: "This account is no longer active. Log in again." });
    }

    req.user = { id: user.id, role: user.role };
    return next();
  } catch (err) {
    return next(err);
  }
}

module.exports = { requireAuth };