// src/server.ts
import "dotenv/config";
import express,  { type ErrorRequestHandler } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import Debug from "debug";
import { v4 as uuidv4 } from "uuid";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/mysql2/migrator";
import session from "express-session";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { dbClient } from "@db/client.js";
import bcrypt from "bcrypt";
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
app.use(cors({
  origin: `${process.env.FRONTEND_URL}`,
  credentials: true,
}));
app.use(express.json());

// --- Session & Passport ---
app.use(
    session({
      secret: process.env.SESSION_SECRET || "secret",
      resave: false,
      saveUninitialized: false,
    })
);

app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user:any, done) => done(null, user));
passport.deserializeUser((user:any, done) => done(null, user));

passport.use(
    new GoogleStrategy(
        {
          clientID: process.env.GOOGLE_CLIENT_ID!,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
          callbackURL: process.env.GOOGLE_CALLBACK_URL!,
        },
        (accessToken, refreshToken, profile, done) => done(null, profile)
    )
);

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
  app.get(route, async (req, res, next) => {
    try {
      const results = await query.findMany();
      res.json(results);
    } catch (err) {
      next(err);
    }
  });

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

  app.delete(`${route}/all`, async (req, res, next) => {
    try {
      await dbClient.delete(table);
      res.json({ msg: `All ${table.name} deleted`, data: {} });
    } catch (err) {
      next(err);
    }
  });
}

// --- Create CRUD routes ---
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

// --- Google OAuth routes ---
app.get("/auth/google", passport.authenticate("google", { scope: ["profile", "email"] }));

app.get(
    "/auth/google/callback",
    passport.authenticate("google", { failureRedirect: "/login" }),
    async (req, res, next) => {
        try {
            const userEmail = (req.user as any).emails[0].value;

            const dbUser:any = await dbClient.query.employee.findFirst({
                where: eq(employee.email, userEmail),
            });

            if (!dbUser) {
                res.redirect(
                    `${process.env.FRONTEND_URL}/unauthorized`
                );
            }

            res.redirect(
                `${process.env.FRONTEND_URL}/${dbUser.role}`
            );
        } catch (err) {
            next(err);
        }
    }
);

//email+password
app.post("/auth/login", async (req, res, next) => {
    try {
        const { email, password } = req.body;

        const dbUser: any = await dbClient.query.employee.findFirst({
            where: eq(employee.email, email),
        });

        if (!dbUser) {
            res.status(401).json({ error: "Invalid credentials" });
        }

        // Compare hash with entered password
        const isMatch = await bcrypt.compare(password, dbUser.password);
        if (!isMatch) {
            res.status(401).json({ error: "Invalid credentials" });
        }

        res.json({
            redirect: `${process.env.FRONTEND_URL}/${dbUser.role}`,
        });
    } catch (err) {
        next(err);
    }
});

// --- JSON Error Middleware ---
const jsonErrorHandler: ErrorRequestHandler = (err, req, res, next) => {
  debug(err.message);
  res.status(500).json({
    message: err.message || "Internal Server Error",
    type: err.name || "Error",
    stack: err.stack,
  });
};
app.use(jsonErrorHandler);

// --- Start server ---
const PORT = process.env.BACKEND_PORT || 5002;
await setupDatabase();
app.listen(PORT, () => {
  debug(`Server listening on http://localhost:${PORT}`);
});
