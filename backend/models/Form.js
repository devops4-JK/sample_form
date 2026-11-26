const { DataTypes } = require("sequelize");
const crypto = require("crypto");

/**
 * A form inside a workbench. The list page reads these.
 *
 * responsesCount / completedCount are counters rather than live joins, so
 * the list stays cheap. Bump them when a submission lands.
 */
module.exports = (sequelize) => {
  const Form = sequelize.define(
    "Form",
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      workbenchId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
      },
      // Whoever created it. Kept for auditing; access follows the workbench.
      ownerId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
      },
      name: {
        type: DataTypes.STRING(160),
        allowNull: false,
        validate: { notEmpty: { msg: "Give the form a name." } },
      },
      // Public share key, used by "Copy link". Never expose the numeric id.
      publicId: {
        type: DataTypes.STRING(24),
        allowNull: false,
        unique: true,
        defaultValue: () => crypto.randomBytes(9).toString("base64url"),
      },
      // Swatch shown next to the name in the list.
      colour: {
        type: DataTypes.STRING(9),
        allowNull: false,
        defaultValue: "#e01e23",
      },
      status: {
        type: DataTypes.ENUM("draft", "published", "closed"),
        allowNull: false,
        defaultValue: "draft",
      },
      responsesCount: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },
      completedCount: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },
      // True once at least one integration is connected.
      integrations: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      // The builder's field definitions. Empty until the builder exists.
      schema: {
        type: DataTypes.JSON,
        allowNull: true,
      },
    },
    {
      tableName: "forms",
    }
  );

  return Form;
};