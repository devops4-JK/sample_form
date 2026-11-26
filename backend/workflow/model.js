const { DataTypes } = require("sequelize");

/**
 * A form's workflow: the logic jumps that decide which page comes next.
 * One row per form at most.
 *
 * A table of its own rather than a column on `forms`, so a plain
 * sequelize.sync() creates it without touching the existing table.
 * `rules` holds { pages: { [pageId]: { rules: [...], otherwise } } } —
 * see engine.js for the full shape.
 */
module.exports = (sequelize) => {
  const FormWorkflow = sequelize.define(
    "FormWorkflow",
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
      rules: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: { pages: {} },
      },
    },
    { tableName: "form_workflows" }
  );

  return FormWorkflow;
};