const { DataTypes } = require("sequelize");

/**
 * Which theme a form wears. One row per form at most.
 *
 * This is a table of its own rather than a column on `forms` on purpose:
 * the app starts with sequelize.sync(), which creates new tables but never
 * alters existing ones, so a new table is the one change that lands on a
 * database that already has data in it.
 */
module.exports = (sequelize) => {
  const FormTheme = sequelize.define(
    "FormTheme",
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      formId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        unique: true,
      },
      themeId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
      },
    },
    {
      tableName: "form_themes",
    }
  );

  return FormTheme;
};