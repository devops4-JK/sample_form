const bcrypt = require("bcryptjs");
const { sortRows } = require("./sorting");
const { ActivityLog, Form, User, Workbench } = require("../models");
const { passwordProblem } = require("./sanitise");

/* Work factor for new password hashes. Existing hashes keep working. */
const HASH_ROUNDS = 12;

/**
 * Admin creates a user account. There is no public sign-up anywhere in the
 * app, so this is the only way a user row is ever born.
 */
exports.createUser = async (req, res, next) => {
  try {
    const { name, email, password, isActive = true } = req.body;

    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ message: "Name, email and password are all required." });
    }

    const weak = passwordProblem(password);
    if (weak) return res.status(400).json({ message: weak });

    const user = await User.create({
      name: String(name).trim().slice(0, 120),
      email: String(email).trim().toLowerCase().slice(0, 160),
      passwordHash: await bcrypt.hash(password, HASH_ROUNDS),
      role: "user",
      isActive: Boolean(isActive),
    });

    return res.status(201).json({ user: user.toSafeJSON() });
  } catch (err) {
    return next(err);
  }
};

exports.listUsers = async (req, res, next) => {
  try {
    const users = await User.findAll({
      where: { role: "user" },
      order: [["createdAt", "DESC"]],
    });
    return res.json({ users: users.map((u) => u.toSafeJSON()) });
  } catch (err) {
    return next(err);
  }
};

/**
 * Edit a user's name, email or access in one go.
 * The `role: "user"` filter stops an admin editing another admin here.
 */
exports.updateUser = async (req, res, next) => {
  try {
    const user = await User.findOne({
      where: { id: req.params.id, role: "user" },
    });
    if (!user) return res.status(404).json({ message: "User not found." });

    const { name, email, isActive } = req.body;

    if (name !== undefined) {
      const trimmed = String(name).trim();
      if (!trimmed) return res.status(400).json({ message: "Name cannot be empty." });
      user.name = trimmed;
    }

    if (email !== undefined) {
      const trimmed = String(email).trim().toLowerCase();
      if (!trimmed) return res.status(400).json({ message: "Email cannot be empty." });
      user.email = trimmed;
    }

    if (isActive !== undefined) user.isActive = Boolean(isActive);

    await user.save();
    return res.json({ user: user.toSafeJSON() });
  } catch (err) {
    if (err.name === "SequelizeValidationError") {
      return res.status(400).json({ message: err.errors[0].message });
    }
    return next(err);
  }
};

/** Turn a user's access on or off without deleting the account. */
exports.setUserAccess = async (req, res, next) => {
  try {
    const user = await User.findOne({
      where: { id: req.params.id, role: "user" },
    });
    if (!user) return res.status(404).json({ message: "User not found." });

    user.isActive = Boolean(req.body.isActive);
    await user.save();

    return res.json({ user: user.toSafeJSON() });
  } catch (err) {
    return next(err);
  }
};

/**
 * Permanently remove a user.
 * The `role: "user"` filter matters: it stops an admin from deleting another
 * admin (or themselves) through this endpoint and locking everyone out.
 */
exports.deleteUser = async (req, res, next) => {
  try {
    const user = await User.findOne({
      where: { id: req.params.id, role: "user" },
    });
    if (!user) return res.status(404).json({ message: "User not found." });

    // Workbenches and forms belong to the company, not to one person, so
    // hand anything this user created to the admin doing the deleting.
    // Without this the database would remove their forms along with them.
    await Workbench.update({ ownerId: req.user.id }, { where: { ownerId: user.id } });
    await Form.update({ ownerId: req.user.id }, { where: { ownerId: user.id } });

    await user.destroy();
    return res.json({ message: "User deleted.", id: Number(req.params.id) });
  } catch (err) {
    return next(err);
  }
};

/** Admin sets a new password for a user who has forgotten theirs. */
exports.resetUserPassword = async (req, res, next) => {
  try {
    const { password } = req.body;

    const weak = passwordProblem(password);
    if (weak) return res.status(400).json({ message: weak });

    const user = await User.findOne({
      where: { id: req.params.id, role: "user" },
    });
    if (!user) return res.status(404).json({ message: "User not found." });

    user.passwordHash = await bcrypt.hash(password, HASH_ROUNDS);
    await user.save();

    return res.json({ message: "Password updated." });
  } catch (err) {
    return next(err);
  }
};

/* ============================ ACTIVITY ============================ */

/** The newest entry per workbench or form, keyed "form:12". */
function latestByEntity(rows) {
  const latest = new Map();
  rows.forEach((r) => {
    const key = `${r.entityType}:${r.entityId}`;
    if (!latest.has(key)) latest.set(key, r);
  });
  return latest;
}

const asEvent = (r) =>
  r && {
    action: r.action,
    detail: r.detail,
    at: r.createdAt,
    by: r.userName,
    byEmail: r.userEmail,
  };

/**
 * GET /api/admin/overview
 *
 * Everything the admin page needs: every workbench and form, who created it
 * and when, what happened to it last and who did that, plus the full history.
 */
exports.overview = async (req, res, next) => {
  try {
    const [workbenches, forms, log] = await Promise.all([
      Workbench.findAll({
        include: [{ model: User, as: "owner", attributes: ["id", "name", "email"] }],
      }),
      /* Without the schema these rows stay small, and the sorting happens
         here — MySQL cannot sort a table this wide. */
      Form.findAll({
        attributes: { exclude: ["schema"] },
        include: [
          { model: User, as: "owner", attributes: ["id", "name", "email"] },
          { model: Workbench, as: "workbench", attributes: ["id", "name"] },
        ],
      }),
      ActivityLog.findAll({ order: [["createdAt", "DESC"]], limit: 500 }),
    ]);

    const sortedWorkbenches = sortRows(workbenches, [["createdAt", "DESC"]]);
    const sortedForms = sortRows(forms, [["updatedAt", "DESC"]]);

    const latest = latestByEntity(log);
    const countByWorkbench = new Map();
    forms.forEach((f) => {
      countByWorkbench.set(f.workbenchId, (countByWorkbench.get(f.workbenchId) || 0) + 1);
    });

    return res.json({
      stats: {
        workbenches: workbenches.length,
        forms: forms.length,
        published: forms.filter((f) => f.status === "published").length,
        responses: forms.reduce((n, f) => n + f.responsesCount, 0),
      },
      workbenches: sortedWorkbenches.map((wb) => ({
        id: wb.id,
        name: wb.name,
        formCount: countByWorkbench.get(wb.id) || 0,
        createdBy: wb.owner ? wb.owner.name : "Unknown",
        createdByEmail: wb.owner ? wb.owner.email : null,
        createdAt: wb.createdAt,
        lastEvent: asEvent(latest.get(`workbench:${wb.id}`)) || null,
      })),
      forms: sortedForms.map((f) => ({
        id: f.id,
        name: f.name,
        colour: f.colour,
        status: f.status,
        responses: f.responsesCount,
        workbench: f.workbench ? f.workbench.name : "—",
        createdBy: f.owner ? f.owner.name : "Unknown",
        createdByEmail: f.owner ? f.owner.email : null,
        createdAt: f.createdAt,
        updatedAt: f.updatedAt,
        lastEvent: asEvent(latest.get(`form:${f.id}`)) || null,
      })),
      activity: log.slice(0, 100).map((r) => ({
        id: r.id,
        entityType: r.entityType,
        entityName: r.entityName,
        action: r.action,
        detail: r.detail,
        by: r.userName,
        byEmail: r.userEmail,
        at: r.createdAt,
      })),
    });
  } catch (err) {
    return next(err);
  }
};