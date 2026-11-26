const { DataTypes } = require("sequelize");

/**
 * One address on a form's validation list, and how far it got.
 *
 * `status` is what the Validation List sheet prints in its middle column:
 *
 *   "waiting" → the cell is left blank. On the list, never opened the form.
 *   "opened"  → "No".  Signed in, but has not reached the end.
 *   "done"    → "Yes", with the date and time it was finished.
 *
 * Where the rows come from depends on the form's way of working. On a
 * customer list they are typed or pasted in ahead of time and start at
 * "waiting". With no list they are written the moment somebody signs in,
 * so they start at "opened".
 *
 * `ticket` is handed to the browser once an address is let through and sent
 * back with the answers. It is what ties a submission to an address without
 * trusting whatever the page claims, and it is cleared once used.
 */
module.exports = (sequelize) => {
  const FormValidationEntry = sequelize.define(
    "FormValidationEntry",
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
      /* Stored lower-cased and trimmed, so "Roger@X.io" and "roger@x.io"
         are one customer and not two. */
      email: {
        type: DataTypes.STRING(190),
        allowNull: false,
      },
      status: {
        type: DataTypes.STRING(16),
        allowNull: false,
        defaultValue: "waiting",
        validate: { isIn: [["waiting", "opened", "done"]] },
      },
      openedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      completedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      /* Which submission finished this address off, so the Responses sheet
         and this one can be lined up row for row. */
      responseId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
      },
      ticket: {
        type: DataTypes.STRING(64),
        allowNull: true,
      },
    },
    {
      tableName: "form_validation_entries",
      // One row per address per form, however many times they come back.
      indexes: [
        { unique: true, fields: ["form_id", "email"] },
        { fields: ["ticket"] },
      ],
    }
  );

  return FormValidationEntry;
};