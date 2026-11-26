const { DataTypes } = require("sequelize");

/**
 * Who did what, and when.
 *
 * Every workbench and form change writes one row here, so the database
 * keeps a record that Arun created a form last month and Jagadeesh edited
 * it today.
 *
 * The user's name and the thing's name are copied in rather than joined, so
 * the history still reads correctly after a rename or after an account is
 * deleted.
 */
module.exports = (sequelize) => {
  const ActivityLog = sequelize.define(
    "ActivityLog",
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      entityType: {
        type: DataTypes.ENUM("workbench", "form", "theme"),
        allowNull: false,
      },
      entityId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
      },
      entityName: {
        type: DataTypes.STRING(160),
        allowNull: false,
      },
      action: {
        type: DataTypes.ENUM(
          "created",
          "renamed",
          "edited",
          "moved",
          "published",
          "unpublished",
          "deleted"
        ),
        allowNull: false,
      },
      // A short human sentence, e.g. "Moved to Festive gifting".
      detail: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      userId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
      },
      userName: {
        type: DataTypes.STRING(120),
        allowNull: false,
      },
      userEmail: {
        type: DataTypes.STRING(160),
        allowNull: true,
      },
    },
    {
      tableName: "activity_log",
      updatedAt: false,
      indexes: [{ fields: ["entity_type", "entity_id"] }, { fields: ["created_at"] }],
    }
  );

  return ActivityLog;
};