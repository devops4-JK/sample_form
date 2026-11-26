const { DataTypes } = require("sequelize");

/**
 * A saved look for a form: type, colours, buttons, background, borders and
 * motion. Themes are shared, the same way workbenches and forms are, so
 * anyone signed in can use, edit or delete one.
 *
 * `config` holds the whole theme as JSON, in the shape the Design section
 * builds (frontend/src/components/design/themes.js). Keeping it in one
 * column means a new control in that panel never needs a new database
 * column here.
 */
module.exports = (sequelize) => {
  const Theme = sequelize.define(
    "Theme",
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      name: {
        type: DataTypes.STRING(120),
        allowNull: false,
        validate: { notEmpty: { msg: "Give the theme a name." } },
      },
      tagline: {
        type: DataTypes.STRING(160),
        allowNull: true,
      },
      config: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: {},
      },
      // Who made it, and who touched it last. Both survive the person
      // being deleted: the theme stays with the company.
      createdById: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
      },
      updatedById: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
      },
    },
    {
      tableName: "themes",
    }
  );

  return Theme;
};