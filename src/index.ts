// src/server.ts
import "dotenv/config";
import express,  { Router, type ErrorRequestHandler } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import Debug from "debug";
import { v4 as uuidv4 } from "uuid";
import { desc, eq } from "drizzle-orm";
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
const frontendOriginEnv = process.env.FRONTEND_URL;

if (!frontendOriginEnv) {
  throw new Error("FRONTEND_URL environment variable is required for CORS configuration");
}

const allowedOrigins = Array.from(
  new Set(
    frontendOriginEnv
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean)
  )
);

if (allowedOrigins.length === 0) {
  throw new Error("FRONTEND_URL must contain at least one origin");
}

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);
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

// --- Role access helpers ---
const roleAccessSelect = {
  id: employee.id,
  fname: employee.fname,
  lname: employee.lname,
  username: employee.username,
  email: employee.email,
  tel: employee.tel,
  role: employee.role,
  status: employee.status,
  createdAt: employee.created_at,
  updatedAt: employee.updated_at,
};

const roleAccessRouter = Router();

roleAccessRouter.get("/users", async (req, res, next) => {
  try {
    const users = await dbClient
      .select(roleAccessSelect)
      .from(employee)
      .orderBy(desc(employee.created_at));

    res.json(users);
  } catch (error) {
    next(error);
  }
});

roleAccessRouter.post("/users", async (req, res, next) => {
  try {
    const {
      fname,
      lname,
      username,
      email,
      tel,
      role,
      status = "Active",
      password,
    } = req.body ?? {};

    if (!fname || !lname || !username || !email || !role || !password) {
      res.status(400).json({ message: "Missing required fields" });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await dbClient.insert(employee).values({
      fname,
      lname,
      username,
      email,
      tel,
      role,
      status,
      password: hashedPassword,
    });

    const [createdUser] = await dbClient
      .select(roleAccessSelect)
      .from(employee)
      .where(eq(employee.email, email))
      .limit(1);

    res.status(201).json(createdUser);
  } catch (error) {
    next(error);
  }
});

roleAccessRouter.patch("/users/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const numericId = Number(id);

    if (!id || Number.isNaN(numericId)) {
      res.status(400).json({ message: "Invalid user id" });
      return;
    }

    const {
      fname,
      lname,
      username,
      email,
      tel,
      role,
      status,
      password,
    } = req.body ?? {};

    const updatePayload: Record<string, unknown> = {};

    if (typeof fname !== "undefined") updatePayload.fname = fname;
    if (typeof lname !== "undefined") updatePayload.lname = lname;
    if (typeof username !== "undefined") updatePayload.username = username;
    if (typeof email !== "undefined") updatePayload.email = email;
    if (typeof tel !== "undefined") updatePayload.tel = tel;
    if (typeof role !== "undefined") updatePayload.role = role;
    if (typeof status !== "undefined") updatePayload.status = status;

    if (typeof password === "string" && password.trim().length > 0) {
      updatePayload.password = await bcrypt.hash(password, 10);
    }

    if (Object.keys(updatePayload).length === 0) {
      res.status(400).json({ message: "No fields provided for update" });
      return;
    }

    await dbClient.update(employee).set(updatePayload).where(eq(employee.id, numericId));

    const [updatedUser] = await dbClient
      .select(roleAccessSelect)
      .from(employee)
      .where(eq(employee.id, numericId))
      .limit(1);

    res.json(updatedUser);
  } catch (error) {
    next(error);
  }
});

roleAccessRouter.delete("/users/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const numericId = Number(id);

    if (!id || Number.isNaN(numericId)) {
      res.status(400).json({ message: "Invalid user id" });
      return;
    }

    await dbClient.delete(employee).where(eq(employee.id, numericId));

    res.json({ success: true, id: numericId });
  } catch (error) {
    next(error);
  }
});

app.use("/role-access", roleAccessRouter);

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
        const { email, password } = req.body ?? {};

        if (!email || !password) {
            res.status(400).json({ message: "Missing email or password" });
            return;
        }

        const dbUser: any = await dbClient.query.employee.findFirst({
            where: eq(employee.email, email),
        });

        if (!dbUser) {
            res.status(401).json({ message: "Invalid credentials" });
            return;
        }

        // Compare hash with entered password
        const isMatch = await bcrypt.compare(password, dbUser.password ?? "");
        if (!isMatch) {
            res.status(401).json({ message: "Invalid credentials" });
            return;
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

// --- ของผมเอง Owner ---
