const { DataTypes } = require("sequelize");

/**
 * The look the *published* form wears — a copy, taken at the moment the
 * form was published.
 *
 * Designing is not publishing: a form wears one theme while it is being
 * built (form_themes) and serves another to the world until someone
 * publishes again. Because this holds its own copy of the settings,
 * editing a theme afterwards never reaches the live link, and deleting
 * the theme does not strip the look off a form that is already out there.
 */
module.exports = (sequelize) => {
  const FormLiveTheme = sequelize.define(
    "FormLiveTheme",
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
      // Which theme it came from. Null once that theme is deleted; the
      // copy below keeps working either way.
      themeId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
      },
      name: {
        type: DataTypes.STRING(120),
        allowNull: true,
      },
      config: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: {},
      },
    },
    {
      tableName: "form_live_themes",
    }
  );

  return FormLiveTheme;
};