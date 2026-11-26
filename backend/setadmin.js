/**
 * Create an admin, or reset an existing admin's password.
 *   node seed/setAdmin.js <email> <password> [name]
 */
require("dotenv").config();
const bcrypt = require("bcryptjs");
const { sequelize, User } = require("../models");

async function run() {
  const [, , rawEmail, password, name] = process.argv;

  if (!rawEmail || !password) {
    console.error("Usage: node seed/setAdmin.js <email> <password> [name]");
    process.exit(1);
  }

  const email = rawEmail.trim().toLowerCase();
  const passwordHash = await bcrypt.hash(password, 10);

  await sequelize.authenticate();
  await sequelize.sync();

  const existing = await User.findOne({ where: { email } });

  if (existing) {
    existing.passwordHash = passwordHash;
    existing.role = "admin";
    existing.isActive = true;
    if (name) existing.name = name;
    await existing.save();
    console.log(`Password reset for admin: ${email}`);
  } else {
    await User.create({
      name: name || "Administrator",
      email,
      passwordHash,
      role: "admin",
      isActive: true,
    });
    console.log(`Admin created: ${email}`);
  }

  const all = await User.findAll({ where: { role: "admin" } });
  console.log("\nAdmin accounts now in the database:");
  all.forEach((u) => console.log(`  ${u.id}  ${u.email}  active=${u.isActive}`));
}

run()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => sequelize.close()); Is the right class



  // admin login to the powershell => backend => image => adminlogin(image)





