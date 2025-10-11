// src/server.ts
import "dotenv/config";
import express,  { Router, type ErrorRequestHandler } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import Debug from "debug";
import { v4 as uuidv4 } from "uuid";
import { and, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
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
const allowedOrigins = frontendOriginEnv
  ? Array.from(
      new Set(
        frontendOriginEnv
          .split(",")
          .map((origin) => origin.trim())
          .filter(Boolean)
      )
    )
  : [];

let corsOrigin: boolean | string | RegExp | (string | RegExp)[] = true;

if (allowedOrigins.length > 0) {
  corsOrigin = allowedOrigins;
} else {
  debug("FRONTEND_URL not configured; falling back to permissive CORS for development");
}

const primaryFrontendUrl = allowedOrigins[0];

app.use(
  cors({
    origin: corsOrigin,
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

const googleClientID = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
const googleCallbackURL = process.env.GOOGLE_CALLBACK_URL;
const isGoogleOAuthConfigured =
  Boolean(googleClientID) && Boolean(googleClientSecret) && Boolean(googleCallbackURL);

if (isGoogleOAuthConfigured) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: googleClientID!,
        clientSecret: googleClientSecret!,
        callbackURL: googleCallbackURL!,
      },
      (accessToken, refreshToken, profile, done) => done(null, profile)
    )
  );
} else {
  debug("Skipping Google OAuth setup; missing GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_CALLBACK_URL");
}

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

// --- Analytics ---
const completedOrderStatuses = ["completed", "paid", "shipped"] as const;
const receivedStockInStatuses = ["received", "completed"] as const;

type MonthRange = {
  start: Date;
  end: Date;
};

async function getMonthlyNetProfit({ start, end }: MonthRange) {
  const [result] = await dbClient
    .select({
      revenue: sql<number>`COALESCE(SUM(COALESCE(${order_items.quantity}, 0) * COALESCE(${order_items.unit_price}, 0)), 0)`,
      cost: sql<number>`COALESCE(SUM(COALESCE(${order_items.quantity}, 0) * COALESCE(${products.cost}, 0)), 0)`,
    })
    .from(order_items)
    .innerJoin(orders, eq(order_items.order_id, orders.id))
    .innerJoin(products, eq(order_items.product_id, products.id))
    .where(
      and(
        gte(orders.order_date, start),
        lt(orders.order_date, end),
        inArray(orders.status, completedOrderStatuses)
      )
    );

  const revenue = Number(result?.revenue ?? 0);
  const cost = Number(result?.cost ?? 0);

  return {
    revenue,
    cost,
    netProfit: revenue - cost,
  };
}

const formatMonthKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

app.get("/analytics/sales/monthly-summary", async (_req, res, next) => {
  try {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const totals = await dbClient
      .select({
        year: sql<number>`YEAR(${orders.order_date})`,
        month: sql<number>`MONTH(${orders.order_date})`,
        totalSales: sql<number>`COALESCE(SUM(${orders.total_amount}), 0)`,
      })
      .from(orders)
      .where(
        and(
          gte(orders.order_date, start),
          lt(orders.order_date, end),
          inArray(orders.status, completedOrderStatuses)
        )
      )
      .groupBy(sql`YEAR(${orders.order_date})`, sql`MONTH(${orders.order_date})`)
      .orderBy(sql`YEAR(${orders.order_date})`, sql`MONTH(${orders.order_date})`);

    const totalsByMonth = new Map<string, number>();

    for (const row of totals) {
      const year = Number(row.year);
      const month = Number(row.month);
      const key = `${year}-${String(month).padStart(2, "0")}`;
      totalsByMonth.set(key, Number(row.totalSales ?? 0));
    }

    const months: Array<{ month: string; totalSales: number }> = [];

    for (let offset = 0; offset < 12; offset += 1) {
      const current = new Date(start.getFullYear(), start.getMonth() + offset, 1);
      const key = formatMonthKey(current);
      months.push({
        month: key,
        totalSales: totalsByMonth.get(key) ?? 0,
      });
    }

    res.json({ months });
  } catch (error) {
    next(error);
  }
});

app.get("/analytics/stock-in/monthly-summary", async (_req, res, next) => {
  try {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const rows = await dbClient
      .select({
        year: sql<number>`YEAR(${stock_in.received_date})`,
        month: sql<number>`MONTH(${stock_in.received_date})`,
        totalQuantity: sql<number>`COALESCE(SUM(COALESCE(${stock_in.quantity}, 0)), 0)`,
        totalValue: sql<number>`COALESCE(SUM(COALESCE(${stock_in.quantity}, 0) * COALESCE(${products.cost}, 0)), 0)`,
      })
      .from(stock_in)
      .innerJoin(products, eq(stock_in.product_id, products.id))
      .where(
        and(
          gte(stock_in.received_date, start),
          lt(stock_in.received_date, end),
          inArray(stock_in.status, receivedStockInStatuses)
        )
      )
      .groupBy(sql`YEAR(${stock_in.received_date})`, sql`MONTH(${stock_in.received_date})`)
      .orderBy(sql`YEAR(${stock_in.received_date})`, sql`MONTH(${stock_in.received_date})`);

    const totalsByMonth = new Map<
      string,
      {
        totalQuantity: number;
        totalValue: number;
      }
    >();

    for (const row of rows) {
      const year = Number(row.year);
      const month = Number(row.month);
      const key = `${year}-${String(month).padStart(2, "0")}`;

      totalsByMonth.set(key, {
        totalQuantity: Number(row.totalQuantity ?? 0),
        totalValue: Number(row.totalValue ?? 0),
      });
    }

    const months: Array<{
      month: string;
      totalQuantity: number;
      totalValue: number;
    }> = [];

    for (let offset = 0; offset < 12; offset += 1) {
      const current = new Date(start.getFullYear(), start.getMonth() + offset, 1);
      const key = formatMonthKey(current);
      const data = totalsByMonth.get(key);

      months.push({
        month: key,
        totalQuantity: data?.totalQuantity ?? 0,
        totalValue: data?.totalValue ?? 0,
      });
    }

    res.json({ months });
  } catch (error) {
    next(error);
  }
});

app.get("/analytics/sales/monthly-total", async (_req, res, next) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const startOfPreviousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const [result] = await dbClient
      .select({
        total: sql<number>`COALESCE(SUM(${orders.total_amount}), 0)`,
      })
      .from(orders)
      .where(
        and(
          gte(orders.order_date, startOfMonth),
          lt(orders.order_date, startOfNextMonth)
        )
      );

    const [previousResult] = await dbClient
      .select({
        total: sql<number>`COALESCE(SUM(${orders.total_amount}), 0)`,
      })
      .from(orders)
      .where(
        and(
          gte(orders.order_date, startOfPreviousMonth),
          lt(orders.order_date, startOfMonth)
        )
      );

    const currentMonthTotal = Number(result?.total ?? 0);
    const previousMonthTotal = Number(previousResult?.total ?? 0);
    const percentChange =
      previousMonthTotal === 0
        ? currentMonthTotal > 0
          ? 100
          : 0
        : ((currentMonthTotal - previousMonthTotal) / Math.abs(previousMonthTotal)) * 100;

    res.json({
      currentMonthTotal,
      previousMonthTotal,
      percentChange,
    });
  } catch (error) {
    next(error);
  }
});

app.get("/analytics/sales/by-employee", async (_req, res, next) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const monthKey = `${startOfMonth.getFullYear()}-${String(startOfMonth.getMonth() + 1).padStart(2, "0")}`;

    const currentSales = await dbClient
      .select({
        employeeId: employee.id,
        fname: employee.fname,
        lname: employee.lname,
        totalSales: sql<number>`COALESCE(SUM(${orders.total_amount}), 0)`,
      })
      .from(employee)
      .leftJoin(
        orders,
        and(
          eq(orders.sale_id, employee.id),
          gte(orders.order_date, startOfMonth),
          lt(orders.order_date, startOfNextMonth),
          inArray(orders.status, completedOrderStatuses)
        )
      )
      .groupBy(employee.id, employee.fname, employee.lname);

    const aggregatedRows = currentSales.map((row) => {
      const totalSales = Number(row.totalSales ?? 0);

      const nameParts = [row.fname, row.lname].filter(Boolean);

      return {
        employeeId: row.employeeId,
        name: nameParts.length > 0 ? nameParts.join(" ").trim() : "ไม่ระบุชื่อ",
        totalSales,
      };
    });

    const sortedRows = aggregatedRows.sort((a, b) => b.totalSales - a.totalSales);
    const leaderTotal = sortedRows[0]?.totalSales ?? 0;

    const rows = sortedRows.map((row, index) => {
      const nextRow = sortedRows[index + 1];
      return {
        rank: index + 1,
        employeeId: row.employeeId,
        name: row.name,
        totalSales: row.totalSales,
        gapToLeader: leaderTotal - row.totalSales,
        gapToNext: nextRow ? row.totalSales - nextRow.totalSales : null,
      };
    });

    res.json({
      month: monthKey,
      rows,
    });
  } catch (error) {
    next(error);
  }
});

app.get("/analytics/profit/monthly-total", async (_req, res, next) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const startOfPreviousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const currentMonthNet = await getMonthlyNetProfit({
      start: startOfMonth,
      end: startOfNextMonth,
    });

    const previousMonthNet = await getMonthlyNetProfit({
      start: startOfPreviousMonth,
      end: startOfMonth,
    });

    const currentNetProfit = currentMonthNet.netProfit;
    const previousNetProfit = previousMonthNet.netProfit;

    const percentChange =
      previousNetProfit === 0
        ? currentNetProfit === 0
          ? 0
          : currentNetProfit > 0
            ? 100
            : -100
        : ((currentNetProfit - previousNetProfit) / Math.abs(previousNetProfit)) * 100;

    res.json(
      {
        currentMonthNetProfit: currentNetProfit,
        previousMonthNetProfit: previousNetProfit,
        percentChange,
      }
    );
  } catch (error) {
    next(error);
  }
});

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
if (isGoogleOAuthConfigured) {
  app.get("/auth/google", passport.authenticate("google", { scope: ["profile", "email"] }));

  app.get(
    "/auth/google/callback",
    passport.authenticate("google", { failureRedirect: "/login" }),
    async (req, res, next) => {
      try {
        const userEmail = (req.user as any).emails[0].value;
        const dbUser: any = await dbClient.query.employee.findFirst({
          where: eq(employee.email, userEmail),
        });

        if (!dbUser) {
          if (primaryFrontendUrl) {
            res.redirect(`${primaryFrontendUrl}/unauthorized`);
          } else {
            res.status(403).json({ message: "Unauthorized" });
          }
          return;
        }

        if (primaryFrontendUrl) {
          res.redirect(`${primaryFrontendUrl}/${dbUser.role}`);
        } else {
          res.json({ message: "Login successful", role: dbUser.role });
        }
      } catch (err) {
        next(err);
      }
    }
  );
} else {
  app.get("/auth/google", (_req, res) => {
    res.status(503).json({ message: "Google OAuth is not configured on this server" });
  });

  app.get("/auth/google/callback", (_req, res) => {
    res.status(503).json({ message: "Google OAuth is not configured on this server" });
  });
}

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

        if (primaryFrontendUrl) {
          res.json({
            redirect: `${primaryFrontendUrl}/${dbUser.role}`,
          });
          return;
        }

        res.json({ message: "Login successful", role: dbUser.role });
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
