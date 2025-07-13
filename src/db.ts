import { config as loadEnv } from "dotenv";
import * as sql from "mssql";

loadEnv();

export const pool = new sql.ConnectionPool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER || "localhost",
  database: process.env.DB_NAME,
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
}).connect();

export { sql };
