/**
 * Creates the first admin account.
 *   npm run seed
 * Safe to run twice: an existing admin with the same email is left alone.
 */
require("dotenv").config();
const bcrypt = require("bcryptjs");
const { sequelize, User } = require("../models");

async function run() {
  const email = (process.env.SEED_ADMIN_EMAIL || "").trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!email || !password) {
    console.error("Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD in .env first.");
    process.exit(1);
  }

  await sequelize.authenticate();
  await sequelize.sync();

  const existing = await User.findOne({ where: { email } });
  if (existing) {
    console.log(`Admin ${email} already exists. Nothing to do.`);
    return;
  }

  await User.create({
    name: process.env.SEED_ADMIN_NAME || "Administrator",
    email,
    passwordHash: await bcrypt.hash(password, 10),
    role: "admin",
    isActive: true,
  });

  console.log(`Admin created: ${email}`);
  console.log("Change the password after your first login.");
}

run()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => sequelize.close());
