import "dotenv/config";

const dbUser = process.env.MYSQL_APP_USER || "preflightG07";
const dbPassword = process.env.MYSQL_APP_PASSWORD || "5678";
const dbHost = process.env.MYSQL_HOST || "mysql";
const dbPort = process.env.MYSQL_PORT || "3306";
const dbName = process.env.MYSQL_DB || "preflightG07";

if (!dbUser || !dbPassword || !dbHost || !dbName) {
  throw new Error("Invalid DB env.");
}

export const connectionConfig = {
  host: dbHost,
  port: Number(dbPort),
  user: dbUser,
  password: String(dbPassword),
  database: dbName,
};
