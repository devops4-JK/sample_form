const { DataTypes } = require("sequelize");

/**
 * A workbench groups forms. One workbench holds at most FORM_LIMIT forms;
 * the cap lives in controllers/formController.js and is enforced there.
 */
module.exports = (sequelize) => {
  const Workbench = sequelize.define(
    "Workbench",
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      // The creator. Only the owner can rename or delete the workbench.
      ownerId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
      },
      name: {
        type: DataTypes.STRING(120),
        allowNull: false,
        validate: { notEmpty: { msg: "Give the workbench a name." } },
      },
    },
    {
      tableName: "workbenches",
    }
  );

  return Workbench;
};
