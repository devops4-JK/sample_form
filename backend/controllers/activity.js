const { ActivityLog, User } = require("../models");

/**
 * Records one change in the activity history (the activity_logs table).
 *
 * The token only carries the user's id, so the name is looked up here and
 * stored on the row. Logging must never break the action that triggered it,
 * so any failure is swallowed after a console warning.
 */
async function logActivity(req, entry) {
  try {
    let userName = "Someone";
    let userEmail = null;
    const userId = req.user?.id ?? null;

    if (userId) {
      const user = await User.findByPk(userId, { attributes: ["name", "email"] });
      if (user) {
        userName = user.name;
        userEmail = user.email;
      }
    }

    await ActivityLog.create({
      entityType: entry.entityType,
      entityId: entry.entityId,
      entityName: String(entry.entityName || "").slice(0, 160),
      action: entry.action,
      detail: entry.detail ? String(entry.detail).slice(0, 255) : null,
      userId,
      userName,
      userEmail,
    });
  } catch (err) {
    console.warn("Could not write the activity log:", err.message);
  }
}

module.exports = { logActivity };