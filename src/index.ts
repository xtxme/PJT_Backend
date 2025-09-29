import "dotenv/config";
import express, { type ErrorRequestHandler } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import Debug from "debug";
import { v4 as uuidv4 } from "uuid";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/mysql2/migrator";

import { dbClient } from "@db/client.js";
import {
  categories,
  suppliers,
  products,
  customers,
  employee,
  orders,
  order_items,
  log,
  stock_in,
} from "@db/schema.js";

const debug = Debug("pf-backend");
const app = express();

// --- Middleware ---
app.use(morgan("dev"));
app.use(helmet());
app.use(cors({ origin: "*" }));
app.use(express.json());

// --- Database setup ---
async function setupDatabase() {
  try {
    debug("Running database migrations...");
    await migrate(dbClient, { migrationsFolder: "./db/migration" });
    debug("Database migrations completed successfully");
  } catch (error) {
    debug("Database migration error:", error);
    throw error;
  }
}

// --- Generic CRUD helper ---
function createCRUDRoutes(query: any, table: any, route: string) {
  // GET all
  app.get(route, async (req, res, next) => {
    try {
      const results = await query.findMany();
      res.json(results);
    } catch (err) {
      next(err);
    }
  });

  // INSERT
  app.post(route, async (req, res, next) => {
    try {
      const data = req.body;
      if (!data) throw new Error("Missing data");
      const id = uuidv4();
      await dbClient.insert(table).values({ ...data, id });
      const result = await dbClient.select().from(table).where(eq(table.id, id));
      res.json({ msg: `${table.name} inserted`, data: result[0] });
    } catch (err) {
      next(err);
    }
  });

  // UPDATE
  app.patch(route, async (req, res, next) => {
    try {
      const { id, ...data } = req.body;
      if (!id) throw new Error("Missing id");
      await dbClient.update(table).set(data).where(eq(table.id, id));
      const result = await dbClient.select().from(table).where(eq(table.id, id));
      res.json({ msg: `${table.name} updated`, data: result[0] });
    } catch (err) {
      next(err);
    }
  });

  // DELETE single
  app.delete(route, async (req, res, next) => {
    try {
      const id = req.body.id;
      if (!id) throw new Error("Missing id");
      await dbClient.delete(table).where(eq(table.id, id));
      res.json({ msg: `${table.name} deleted`, data: { id } });
    } catch (err) {
      next(err);
    }
  });

  // DELETE all
  app.delete(`${route}/all`, async (req, res, next) => {
    try {
      await dbClient.delete(table);
      res.json({ msg: `All ${table.name} deleted`, data: {} });
    } catch (err) {
      next(err);
    }
  });
}

// --- Create CRUD routes for all tables ---
createCRUDRoutes(dbClient.query.categories, categories, "/categories");
createCRUDRoutes(dbClient.query.suppliers, suppliers, "/suppliers");
createCRUDRoutes(dbClient.query.products, products, "/products");
createCRUDRoutes(dbClient.query.customers, customers, "/customers");
createCRUDRoutes(dbClient.query.employee, employee, "/employee");
createCRUDRoutes(dbClient.query.orders, orders, "/orders");
createCRUDRoutes(dbClient.query.order_items, order_items, "/order_items");
createCRUDRoutes(dbClient.query.log, log, "/log");
createCRUDRoutes(dbClient.query.stock_in, stock_in, "/stock_in");

// --- Owner example ---
app.get("/owner", (req, res) => {
  res.json({
    id: "660610757",
    name: "Natrada Nuchit",
    course_id: "269497",
    section: "001",
  });
});

// --- JSON Error Middleware ---
const jsonErrorHandler: ErrorRequestHandler = (err, req, res, next) => {
  debug(err.message);
  const errorResponse = {
    message: err.message || "Internal Server Error",
    type: err.name || "Error",
    stack: err.stack,
  };
  res.status(500).send(errorResponse);
};
app.use(jsonErrorHandler);

// --- Start server ---
const PORT = process.env.PORT || 3000;
await setupDatabase();
app.listen(PORT, () => {
  debug(`Server listening on http://localhost:${PORT}`);
});
