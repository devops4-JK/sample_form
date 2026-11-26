const sequelize = require("../config/db");

const User = require("./User")(sequelize);
const Workbench = require("./Workbench")(sequelize);
const Form = require("./Form")(sequelize);
const FormResponse = require("./FormResponse")(sequelize);
const FormQuestion = require("./FormQuestion")(sequelize);
const FormIntegration = require("./FormIntegration")(sequelize);
const ActivityLog = require("./ActivityLog")(sequelize);
const Theme = require("./Theme")(sequelize);
const FormTheme = require("./FormTheme")(sequelize);
const FormLiveTheme = require("./FormLiveTheme")(sequelize);
const FormValidation = require("./FormValidation")(sequelize);
const FormValidationEntry = require("./FormValidationEntry")(sequelize);
const FormSheet = require("./FormSheet")(sequelize);
const FormWorkflow = require("../workflow/model")(sequelize);
const { FormAutomation, FormAutomationLog } = require("../workflow/automationModels")(sequelize);

// ---- workbenches ----
User.hasMany(Workbench, { foreignKey: "ownerId", onDelete: "CASCADE" });
Workbench.belongsTo(User, { foreignKey: "ownerId", as: "owner" });

// ---- forms ----
// Deleting a workbench takes its forms with it.
Workbench.hasMany(Form, { foreignKey: "workbenchId", as: "forms", onDelete: "CASCADE" });
Form.belongsTo(Workbench, { foreignKey: "workbenchId", as: "workbench" });
User.hasMany(Form, { foreignKey: "ownerId", onDelete: "CASCADE" });
Form.belongsTo(User, { foreignKey: "ownerId", as: "owner" });

// Deleting a form takes its submissions with it.
Form.hasMany(FormResponse, { foreignKey: "formId", as: "responses", onDelete: "CASCADE" });
FormResponse.belongsTo(Form, { foreignKey: "formId" });

// The flat copy of each form's questions, and its Excel feed.
Form.hasMany(FormQuestion, { foreignKey: "formId", as: "questions", onDelete: "CASCADE" });
FormQuestion.belongsTo(Form, { foreignKey: "formId" });
Form.hasMany(FormIntegration, { foreignKey: "formId", as: "connections", onDelete: "CASCADE" });
FormIntegration.belongsTo(Form, { foreignKey: "formId" });

// ---- themes ----
// Themes are shared and belong to the company, so losing the person who
// made one leaves the theme in place with an empty author.
User.hasMany(Theme, { foreignKey: "createdById", onDelete: "SET NULL" });
Theme.belongsTo(User, { foreignKey: "createdById", as: "createdBy" });
Theme.belongsTo(User, { foreignKey: "updatedById", as: "updatedBy" });

// Which theme a form wears. Deleting either end clears the link, never
// the form and never the other themes.
Form.hasOne(FormTheme, { foreignKey: "formId", as: "themeLink", onDelete: "CASCADE" });
FormTheme.belongsTo(Form, { foreignKey: "formId" });
Theme.hasMany(FormTheme, { foreignKey: "themeId", as: "uses", onDelete: "CASCADE" });
FormTheme.belongsTo(Theme, { foreignKey: "themeId", as: "theme" });

// The copy the published link serves. It holds its own settings, so it
// survives the theme being edited or deleted.
Form.hasOne(FormLiveTheme, { foreignKey: "formId", as: "liveTheme", onDelete: "CASCADE" });
FormLiveTheme.belongsTo(Form, { foreignKey: "formId" });

// ---- validation ----
// Who may fill a form in, and how far each of them got. Both go with the
// form: delete the form and its list goes too, and nothing else notices.
Form.hasOne(FormValidation, { foreignKey: "formId", as: "validation", onDelete: "CASCADE" });
FormValidation.belongsTo(Form, { foreignKey: "formId" });

Form.hasMany(FormValidationEntry, {
  foreignKey: "formId",
  as: "validationEntries",
  onDelete: "CASCADE",
});
FormValidationEntry.belongsTo(Form, { foreignKey: "formId" });

// ---- Google Sheets ----
// The sheet a form is linked to. Goes with the form.
Form.hasOne(FormSheet, { foreignKey: "formId", as: "sheet", onDelete: "CASCADE" });
FormSheet.belongsTo(Form, { foreignKey: "formId" });

// ---- workflow ----
// The logic jumps between pages. Goes with the form.
Form.hasOne(FormWorkflow, { foreignKey: "formId", as: "workflow", onDelete: "CASCADE" });
FormWorkflow.belongsTo(Form, { foreignKey: "formId" });

// Webhook and email after a submission, and their delivery log. Go with the form.
Form.hasOne(FormAutomation, { foreignKey: "formId", as: "automation", onDelete: "CASCADE" });
FormAutomation.belongsTo(Form, { foreignKey: "formId" });
Form.hasMany(FormAutomationLog, { foreignKey: "formId", as: "automationLogs", onDelete: "CASCADE" });
FormAutomationLog.belongsTo(Form, { foreignKey: "formId" });

module.exports = {
  sequelize,
  User,
  Workbench,
  Form,
  FormResponse,
  FormQuestion,
  FormIntegration,
  ActivityLog,
  Theme,
  FormTheme,
  FormLiveTheme,
  FormValidation,
  FormValidationEntry,
  FormSheet,
  FormWorkflow,
  FormAutomation,
  FormAutomationLog,
};