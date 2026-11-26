/**
 * Manage user accounts from the command line. There is no admin page and no
 * public sign-up: this script, run on the server, is how accounts are made.
 *
 *   npm run users -- list
 *   npm run users -- add <email> "<Full name>"      asks for a password
 *   npm run users -- reset <email>                   asks for a new password
 *   npm run users -- disable <email>                 locked out at next click
 *   npm run users -- enable <email>
 *   npm run users -- remove <email> --give-to <other-email>
 *
 * Passwords are typed at a hidden prompt, never on the command line, so they
 * do not end up in the shell history. They follow the same rules as before:
 * at least 8 characters, with a letter and a number.
 */
require("dotenv").config();
const readline = require("readline");
const bcrypt = require("bcryptjs");
const { sequelize, User, Workbench, Form } = require("../models");
const { passwordProblem } = require("../controllers/sanitise");

const HASH_ROUNDS = 12;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const USAGE = `Usage:
  npm run users -- list
  npm run users -- add <email> "<Full name>"
  npm run users -- reset <email>
  npm run users -- disable <email>
  npm run users -- enable <email>
  npm run users -- remove <email> --give-to <other-email>`;

/*
 * One prompt reader for the whole run. Lines are queued as they arrive, so
 * two questions in a row also work when the answers are piped in. On a
 * terminal, readline's own echo is switched off, so the password never
 * appears on screen.
 */
let prompt = null;
const lines = [];
const waiting = [];
let ended = false;

function startPrompt() {
  const terminal = Boolean(process.stdin.isTTY);
  prompt = readline.createInterface({ input: process.stdin, output: process.stdout, terminal });
  if (terminal) prompt._writeToOutput = () => {}; // never echo what is typed
  prompt.on("line", (line) => (waiting.length ? waiting.shift()(line) : lines.push(line)));
  prompt.on("close", () => {
    ended = true;
    while (waiting.length) waiting.shift()(null);
  });
}

function askHidden(question) {
  if (!prompt) startPrompt();
  process.stdout.write(question);
  return new Promise((resolve, reject) => {
    const answer = (line) => {
      process.stdout.write("\n");
      if (line === null) reject(new Error("No password was typed."));
      else resolve(line);
    };
    if (lines.length) answer(lines.shift());
    else if (ended) answer(null);
    else waiting.push(answer);
  });
}

async function newPassword() {
  const first = await askHidden("New password: ");
  const weak = passwordProblem(first);
  if (weak) throw new Error(weak);
  const second = await askHidden("Type it again: ");
  if (first !== second) throw new Error("The two passwords do not match.");
  return bcrypt.hash(first, HASH_ROUNDS);
}

const tidyEmail = (e) => String(e || "").trim().toLowerCase();

async function findUser(email) {
  const user = await User.findOne({ where: { email: tidyEmail(email), role: "user" } });
  if (!user) throw new Error(`No user account with the email ${tidyEmail(email)}.`);
  return user;
}

async function run() {
  const [command, ...args] = process.argv.slice(2);
  if (!command) throw new Error(USAGE);

  await sequelize.authenticate();
  await sequelize.sync();

  switch (command) {
    case "list": {
      const users = await User.findAll({ where: { role: "user" }, order: [["email", "ASC"]] });
      if (!users.length) return console.log("No user accounts yet.");
      users.forEach((u) =>
        console.log(
          `${u.isActive ? "active  " : "disabled"}  ${u.email.padEnd(40)}  ${u.name}${
            u.lastLoginAt ? `  (last in ${u.lastLoginAt.toISOString().slice(0, 10)})` : ""
          }`
        )
      );
      return undefined;
    }

    case "add": {
      const [email, ...nameParts] = args;
      const name = nameParts.join(" ").trim().slice(0, 120);
      if (!email || !name) throw new Error(USAGE);
      if (!EMAIL_RE.test(tidyEmail(email))) throw new Error("That is not an email address.");
      if (await User.findOne({ where: { email: tidyEmail(email) } })) {
        throw new Error(`An account with ${tidyEmail(email)} already exists.`);
      }
      const passwordHash = await newPassword();
      await User.create({ name, email: tidyEmail(email).slice(0, 160), passwordHash, role: "user", isActive: true });
      return console.log(`Added ${tidyEmail(email)}. They can sign in now.`);
    }

    case "reset": {
      const user = await findUser(args[0]);
      user.passwordHash = await newPassword();
      await user.save();
      return console.log(`Password changed for ${user.email}.`);
    }

    case "disable":
    case "enable": {
      const user = await findUser(args[0]);
      user.isActive = command === "enable";
      await user.save();
      return console.log(`${user.email} is now ${user.isActive ? "active" : "disabled"}.`);
    }

    case "remove": {
      const user = await findUser(args[0]);
      const at = args.indexOf("--give-to");
      if (at === -1 || !args[at + 1]) {
        throw new Error("Say who takes over their workbenches and forms: --give-to <other-email>");
      }
      const heir = await findUser(args[at + 1]);
      if (heir.id === user.id) throw new Error("Give the forms to someone else.");
      // Workbenches and forms belong to the company, not to one person:
      // without this the database would delete their forms with them.
      await sequelize.transaction(async (transaction) => {
        await Workbench.update({ ownerId: heir.id }, { where: { ownerId: user.id }, transaction });
        await Form.update({ ownerId: heir.id }, { where: { ownerId: user.id }, transaction });
        await user.destroy({ transaction });
      });
      return console.log(`Removed ${user.email}. Their workbenches and forms now belong to ${heir.email}.`);
    }

    default:
      throw new Error(USAGE);
  }
}

run()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => {
    if (prompt) prompt.close();
    return sequelize.close();
  });