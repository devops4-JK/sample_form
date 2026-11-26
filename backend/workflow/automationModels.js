const { DataTypes } = require("sequelize");

/**
 * What happens after a form is submitted: a webhook, an email to the team,
 * and a confirmation email to the respondent. One row per form at most.
 *
 * And a short delivery log, so the Automations panel can show whether the
 * last sends worked. Only the newest 50 rows per form are kept.
 *
 * Tables of their own, so a plain sequelize.sync() creates them without
 * touching the existing tables.
 */
module.exports = (sequelize) => {
  const FormAutomation = sequelize.define(
    "FormAutomation",
    {
      id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
      formId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, unique: true },

      webhookEnabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      webhookUrl: { type: DataTypes.STRING(500), allowNull: true },
      // Signs every delivery (HMAC-SHA256) so the receiver can prove it came from here.
      webhookSecret: { type: DataTypes.STRING(64), allowNull: true },

      emailEnabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      emailTo: { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
      emailSubject: { type: DataTypes.STRING(200), allowNull: true },

      confirmEnabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      // The email question whose answer receives the confirmation.
      confirmFieldId: { type: DataTypes.STRING(64), allowNull: true },
      confirmSubject: { type: DataTypes.STRING(200), allowNull: true },
      confirmMessage: { type: DataTypes.TEXT, allowNull: true },
    },
    { tableName: "form_automations" }
  );

  const FormAutomationLog = sequelize.define(
    "FormAutomationLog",
    {
      id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
      formId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      responseId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
      channel: { type: DataTypes.ENUM("webhook", "email", "confirm"), allowNull: false },
      ok: { type: DataTypes.BOOLEAN, allowNull: false },
      test: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      attempts: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 1 },
      detail: { type: DataTypes.STRING(300), allowNull: true },
    },
    { tableName: "form_automation_logs" }
  );

  return { FormAutomation, FormAutomationLog };
};