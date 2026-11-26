const { DataTypes } = require("sequelize");

/**
 * One row per element in a form, stored alongside the form's name.
 *
 * Form.schema stays the source of truth the builder edits. This table is a
 * flat, queryable copy of it, rebuilt every time the builder saves, so
 * questions can be listed, reported on, or joined without parsing JSON.
 */
module.exports = (sequelize) => {
  const FormQuestion = sequelize.define(
    "FormQuestion",
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      formId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
      },
      formName: {
        type: DataTypes.STRING(160),
        allowNull: false,
      },
      pageId: {
        type: DataTypes.STRING(64),
        allowNull: false,
      },
      pageName: {
        type: DataTypes.STRING(160),
        allowNull: true,
      },
      // 1-based page number, then 1-based position within that page.
      pageNumber: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
      },
      position: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
      },
      // The builder's own id for the field. Response answers are keyed by it.
      fieldId: {
        type: DataTypes.STRING(64),
        allowNull: false,
      },
      type: {
        type: DataTypes.STRING(40),
        allowNull: false,
      },
      label: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      placeholder: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      required: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      // False for screens and section dividers, which show text but take no answer.
      collectsAnswer: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      // Everything else about the field: options, sub-fields, ranges, and so on.
      settings: {
        type: DataTypes.JSON,
        allowNull: true,
      },
    },
    {
      tableName: "form_questions",
      indexes: [{ fields: ["form_id"] }],
    }
  );

  return FormQuestion;
};