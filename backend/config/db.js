const { Sequelize } = require("sequelize");

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 3306,
    dialect: "mysql",
    logging: false,
    define: {const { Sequelize } = require("sequelize");

/* Hosted MySQL (TiDB Cloud, Aiven, etc.) needs an encrypted connection.
   Set DB_SSL=true on the server to turn it on. Leave it unset for a local
   MySQL on your own computer. */
const useSSL = String(process.env.DB_SSL || "").toLowerCase() === "true";

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 3306,
    dialect: "mysql",
    logging: false,
    dialectOptions: useSSL
      ? { ssl: { minVersion: "TLSv1.2", rejectUnauthorized: true } }
      : {},
    define: {
      underscored: true,
      freezeTableName: false,
    },
  }
);

module.exports = sequelize;
      underscored: true,
      freezeTableName: false,
    },
  }
);

module.exports = sequelize;
