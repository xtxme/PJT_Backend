import "dotenv/config";
import Debug from "debug";
import { migrate } from "drizzle-orm/mysql2/migrator";
import { dbClient } from "@db/client.js";
import app from "./app.js";

const debug = Debug("pf-backend");
const PORT = Number(process.env.BACKEND_PORT || 5002);

async function bootstrap() {
    // migrate db ตอนสตาร์ต
    debug("Running database migrations...");
    await migrate(dbClient, { migrationsFolder: "./db/migration" });
    debug("Database migrations completed");

    app.listen(PORT, () => {
        debug(`Server listening on http://localhost:${PORT}`);
    });
}

bootstrap().catch((err) => {
    debug("Fatal error:", err);
    process.exit(1);
});
