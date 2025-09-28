import "dotenv/config";
import { defineConfig } from "drizzle-kit";
import { connectionConfig } from "./db/utils.ts";

const connectionString = `mysql://${connectionConfig.user}:${connectionConfig.password}@${connectionConfig.host}:${connectionConfig.port}/${connectionConfig.database}`;

export default defineConfig({
  dialect: "mysql",
  schema: "./db/schema.ts",
  out: "db/migration",
  dbCredentials: {
    url: connectionString,
  },
  verbose: true,
  strict: true,
});
