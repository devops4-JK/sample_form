const { DataTypes } = require("sequelize");

/**
 * How a form decides who may fill it in. One row per form.
 *
 * Three ways, and a form is always on exactly one of them:
 *
 *   "list"  — I have a customer list. Only the addresses on it may open the
 *             form; anyone else is turned away.
 *   "open"  — I do not have a list. Anyone may open the form once, and the
 *             address they sign in with is added to the list as they go.
 *   "none"  — No validation at all. No sign-in, no list, no limit on how
 *             many times one person fills the form in.
 *
 * "none" is the default, so every form that existed before this feature
 * behaves exactly as it did.
 *
 * Its own table rather than new columns on `forms`, so a plain
 * sequelize.sync() creates it without touching the existing table.
 */
module.exports = (sequelize) => {
  const FormValidation = sequelize.define(
    "FormValidation",
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
      /* Plain strings rather than an ENUM: adding a fourth way later is
         then a code change, never an ALTER on a live table. */
      mode: {
        type: DataTypes.STRING(16),
        allowNull: false,
        defaultValue: "none",
        validate: { isIn: [["none", "list", "open"]] },
      },
      /**
       * Whether someone who signed in but never reached the end may come
       * back and carry on. On by default: a closed laptop should not lock
       * a customer out for good. Turn it off to make one sign-in final.
       */
      allowResume: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      /* What the respondent reads on each of the two refusals. Blank means
         use the wording built into the page. */
      notListedMessage: {
        type: DataTypes.STRING(300),
        allowNull: true,
      },
      alreadyDoneMessage: {
        type: DataTypes.STRING(300),
        allowNull: true,
      },
    },
    { tableName: "form_validations" }
  );

  return FormValidation;
};