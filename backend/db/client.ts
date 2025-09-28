// import { drizzle } from "drizzle-orm/postgres-js";
// import * as schema from "@db/schema.js";
// import postgres from "postgres";
// import { connectionString } from "@db/utils.js";

// export const dbConn = postgres(connectionString);

// export const dbClient = drizzle(dbConn, { schema: schema, logger: true });

import { drizzle } from "drizzle-orm/mysql2";
import * as schema from "@db/schema.js";
import mysql from "mysql2/promise";
import { connectionConfig } from "@db/utils.js";

export const dbConn = await mysql.createConnection(connectionConfig);

export const dbClient = drizzle(dbConn, { schema, mode: "default" });
