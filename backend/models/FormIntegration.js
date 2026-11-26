const { DataTypes } = require("sequelize");

/**
 * A connection from a form to an outside tool. Today that is Excel.
 *
 * The token is the secret part of the feed URL. Anyone holding the URL can
 * read the form's responses, so regenerating the token cuts off every old
 * copy of the link, and deleting the row turns the feed off.
 *
 * Kept in its own table (rather than new columns on `forms`) so it appears
 * with a plain sequelize.sync(), with no ALTER on the existing table.
 */
module.exports = (sequelize) => {
  const FormIntegration = sequelize.define(
    "FormIntegration",
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
      type: {
        type: DataTypes.ENUM("excel"),
        allowNull: false,
        defaultValue: "excel",
      },
      token: {
        type: DataTypes.STRING(64),
        allowNull: false,
        unique: true,
      },
      // Set each time Excel (or anyone with the link) pulls the feed.
      lastSyncedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      syncCount: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },
    },
    {
      tableName: "form_integrations",
      indexes: [{ unique: true, fields: ["form_id", "type"] }],
    }
  );

  return FormIntegration;
};