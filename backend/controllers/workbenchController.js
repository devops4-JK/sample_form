const { Workbench, Form, User, sequelize } = require("../models");
const { FORM_LIMIT, loadWorkbench } = require("./workbenchAccess");
const { logActivity } = require("./activity");

/**
 * Workbenches are shared by everyone in the company. Whoever is signed in
 * sees the same list and may create, rename and delete any of them; the
 * creator is kept for the activity history.
 */

function serialise(wb, formCount, owner) {
  return {
    id: wb.id,
    name: wb.name,
    ownerId: wb.ownerId,
    createdBy: owner ? { id: owner.id, name: owner.name, email: owner.email } : null,
    formCount,
    limit: FORM_LIMIT,
    isFull: formCount >= FORM_LIMIT,
    createdAt: wb.createdAt,
    updatedAt: wb.updatedAt,
  };
}

const withOwner = {
  include: [{ model: User, as: "owner", attributes: ["id", "name", "email"] }],
  order: [["createdAt", "ASC"]],
};

/** Every workbench, with its form count and who created it. */
exports.list = async (req, res, next) => {
  try {
    let rows = await Workbench.findAll(withOwner);

    // An empty company gets one shared workbench to start from.
    if (!rows.length) {
      const starter = await Workbench.create({ name: "Shared workbench", ownerId: req.user.id });
      await logActivity(req, {
        entityType: "workbench",
        entityId: starter.id,
        entityName: starter.name,
        action: "created",
      });
      rows = await Workbench.findAll(withOwner);
    }

    const counts = await Form.findAll({
      attributes: ["workbenchId", [sequelize.fn("COUNT", sequelize.col("id")), "n"]],
      group: ["workbenchId"],
      raw: true,
    });
    const countById = new Map(counts.map((c) => [Number(c.workbenchId), Number(c.n)]));

    return res.json({
      workbenches: rows.map((wb) => serialise(wb, countById.get(wb.id) || 0, wb.owner)),
      limit: FORM_LIMIT,
    });
  } catch (err) {
    return next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    const name = (req.body.name || "").trim();
    if (!name) return res.status(400).json({ message: "Give the workbench a name." });

    const workbench = await Workbench.create({ name, ownerId: req.user.id });
    await logActivity(req, {
      entityType: "workbench",
      entityId: workbench.id,
      entityName: workbench.name,
      action: "created",
    });

    const owner = await User.findByPk(req.user.id, { attributes: ["id", "name", "email"] });
    return res.status(201).json({ workbench: serialise(workbench, 0, owner) });
  } catch (err) {
    return next(err);
  }
};

exports.rename = async (req, res, next) => {
  try {
    const access = await loadWorkbench(req.params.id);
    if (!access) return res.status(404).json({ message: "Workbench not found." });

    const name = (req.body.name || "").trim();
    if (!name) return res.status(400).json({ message: "Give the workbench a name." });

    const before = access.workbench.name;
    access.workbench.name = name;
    await access.workbench.save();

    if (before !== name) {
      await logActivity(req, {
        entityType: "workbench",
        entityId: access.workbench.id,
        entityName: name,
        action: "renamed",
        detail: `Renamed from "${before}"`,
      });
    }

    const formCount = await Form.count({ where: { workbenchId: access.workbench.id } });
    const owner = await User.findByPk(access.workbench.ownerId, {
      attributes: ["id", "name", "email"],
    });
    return res.json({ workbench: serialise(access.workbench, formCount, owner) });
  } catch (err) {
    return next(err);
  }
};

/** Deletes the workbench and, through the association, its forms. */
exports.remove = async (req, res, next) => {
  try {
    const access = await loadWorkbench(req.params.id);
    if (!access) return res.status(404).json({ message: "Workbench not found." });

    if ((await Workbench.count()) <= 1) {
      return res
        .status(409)
        .json({ message: "This is the only workbench. Create another one before deleting it." });
    }

    const formCount = await Form.count({ where: { workbenchId: access.workbench.id } });
    const name = access.workbench.name;
    await access.workbench.destroy();

    await logActivity(req, {
      entityType: "workbench",
      entityId: Number(req.params.id),
      entityName: name,
      action: "deleted",
      detail: formCount ? `With ${formCount} form${formCount === 1 ? "" : "s"}` : null,
    });

    return res.json({ message: "Workbench deleted.", id: Number(req.params.id) });
  } catch (err) {
    return next(err);
  }
};