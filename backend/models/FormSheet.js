const { DataTypes } = require("sequelize");

/**
 * The Google Sheet a form is linked to. One row per form at most.
 *
 * While a form is linked, the app keeps that sheet in step with itself:
 * it reads the customer list out of the sheet, and writes every response
 * and every validation status back into it. See sheets/sync.js.
 *
 * A table of its own rather than new columns on `forms`, so a plain
 * sequelize.sync() creates it without touching the existing table.
 */
module.exports = (sequelize) => {
  const FormSheet = sequelize.define(
    "FormSheet",
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
      // The long id in the middle of the sheet's web address.
      spreadsheetId: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      // The sheet's own name, shown on the Connect tab.
      title: {
        type: DataTypes.STRING(200),
        allowNull: true,
      },
      lastSyncedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      // Why the last attempt failed, in words for the Connect tab. Null
      // when the last attempt worked.
      lastError: {
        type: DataTypes.STRING(300),
        allowNull: true,
      },
    },
    { tableName: "form_sheets" }
  );

  return FormSheet;
};