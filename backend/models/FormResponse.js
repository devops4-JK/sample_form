const { DataTypes } = require("sequelize");

/**
 * One submission of one form.
 *
 * `answers` is a JSON object keyed by field id, matching the ids in
 * Form.schema, so a response stays readable even after the form is edited.
 */
module.exports = (sequelize) => {
  const FormResponse = sequelize.define(
    "FormResponse",
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
      answers: {
        type: DataTypes.JSON,
        allowNull: false,
      },
      // False when someone saves partway through rather than finishing.
      completed: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
    },
    {
      tableName: "form_responses",
    }
  );

  return FormResponse;
};