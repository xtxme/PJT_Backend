import { Router } from "express";
import { and, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { dbClient } from "@db/client.js";
import { orders, order_items, products, stock_in, employee, customers } from "@db/schema.js";

const router = Router();

const completedOrderStatuses = ["completed"] as const;
const receivedStockInStatuses = ["completed", "some_received"] as const;

type MonthRange = {
  start: Date;
  end: Date;
};

type StockInMonthlyRecord = {
  month: string;
  totalQuantity: number;
  totalValue: number;
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

async function getStockInMonthlySummary({ start, end }: MonthRange): Promise<StockInMonthlyRecord[]> {
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

  const months: StockInMonthlyRecord[] = [];

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

  return months;
}

//Sale Summary
router.get("/sales/monthly-summary", async (_req, res, next) => {
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

//Stock In Purchase Summary
router.get("/stock-in/monthly-summary", async (_req, res, next) => {
  try {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const months = await getStockInMonthlySummary({ start, end });

    res.json({ months });
  } catch (error) {
    next(error);
  }
});

//Stock In Purchase Summary
router.get("/stock-in/summary", async (_req, res, next) => {
  try {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const months = await getStockInMonthlySummary({ start, end });

    const data = months.map((month) => ({
      month_key: month.month,
      total_value: month.totalValue,
      total_quantity: month.totalQuantity,
    }));

    res.json({ data });
  } catch (error) {
    next(error);
  }
});

//ยอดขายรวม
router.get("/sales/monthly-total", async (_req, res, next) => {
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

//ยอดขายรายบุคคลของพนักงาน
router.get("/sales/by-employee", async (_req, res, next) => {
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

//กำไรสุทธิ
router.get("/profit/monthly-total", async (_req, res, next) => {
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

    res.json({
      currentMonthNetProfit: currentNetProfit,
      previousMonthNetProfit: previousNetProfit,
      percentChange,
    });
  } catch (error) {
    next(error);
  }
});

//Highest Order Value by Customer
router.get("/customers/top-order-value", async (_req, res, next) => {
  try {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const rows = await dbClient
      .select({
        customerId: customers.id,
        fname: customers.fname,
        lname: customers.lname,
        totalOrderValue: sql<number>`COALESCE(SUM(${orders.total_amount}), 0)`,
      })
      .from(orders)
      .innerJoin(customers, eq(orders.customer_id, customers.id))
      .where(
        and(
          gte(orders.order_date, start),
          lt(orders.order_date, end),
          inArray(orders.status, completedOrderStatuses)
        )
      )
      .groupBy(customers.id, customers.fname, customers.lname)
      .orderBy(sql`COALESCE(SUM(${orders.total_amount}), 0) DESC`)
      .limit(6);

    const result = rows.map((row) => {
      const totalOrderValue = Number(row.totalOrderValue ?? 0);
      const nameParts = [row.fname, row.lname].filter(Boolean);

      return {
        customerId: row.customerId,
        name: nameParts.length > 0 ? nameParts.join(" ").trim() : "ไม่ระบุชื่อ",
        totalOrderValue,
        totalAmount: totalOrderValue,
        value: totalOrderValue,
      };
    });

    res.json({
      range: {
        start: start.toISOString(),
        end: end.toISOString(),
      },
      customers: result,
    });
  } catch (error) {
    next(error);
  }
});

//Highest Order Value by Company
router.get("/company/top-order-value", async (_req, res, next) => {
  try {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const rows = await dbClient
      .select({
        company: products.company,
        totalOrderValue: sql<number>`COALESCE(SUM(COALESCE(${order_items.quantity}, 0) * COALESCE(${order_items.unit_price}, 0)), 0)`,
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
      )
      .groupBy(products.company)
      .orderBy(sql`COALESCE(SUM(COALESCE(${order_items.quantity}, 0) * COALESCE(${order_items.unit_price}, 0)), 0) DESC`)
      .limit(6);

    const companies = rows.map((row) => {
      const totalOrderValue = Number(row.totalOrderValue ?? 0);
      const name = row.company?.trim() || "ไม่ระบุบริษัท";

      return {
        company: name,
        name,
        totalOrderValue,
        totalAmount: totalOrderValue,
        value: totalOrderValue,
      };
    });

    res.json({
      range: {
        start: start.toISOString(),
        end: end.toISOString(),
      },
      companies,
    });
  } catch (error) {
    next(error);
  }
});

//Dead Stock
router.get("/dead-stock/monthly-summary", async (_req, res, next) => {
  try {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    type DeadStockProductRow = {
      month_key: string;
      product_id: number | string | null;
      product_name: string | null;
      dead_qty: number | string | null;
      unit_cost: number | string | null;
      dead_value: number | string | null;
    };

    const query = sql<DeadStockProductRow[]>`
      WITH RECURSIVE month_series AS (
        SELECT DATE(${start}) AS month_start
        UNION ALL
        SELECT DATE_ADD(month_start, INTERVAL 1 MONTH)
        FROM month_series
        WHERE DATE_ADD(month_start, INTERVAL 1 MONTH) < DATE(${end})
      ),
      month_bounds AS (
        SELECT
          month_start,
          DATE_ADD(month_start, INTERVAL 1 MONTH) AS month_end,
          DATE_FORMAT(month_start, '%Y-%m') AS month_key
        FROM month_series
      )
      SELECT
        mb.month_key,
        p.id AS product_id,
        p.name AS product_name,
        p.quantity AS dead_qty,
        COALESCE(p.cost, 0) AS unit_cost,
        p.quantity * COALESCE(p.cost, 0) AS dead_value
      FROM month_bounds mb
      INNER JOIN products p
        ON p.quantity > 0
        AND NOT EXISTS (
          SELECT 1
          FROM order_items oi
          INNER JOIN orders o ON o.id = oi.order_id
          WHERE oi.product_id = p.id
            AND o.order_date >= mb.month_start
            AND o.order_date < mb.month_end
            AND o.status IN ('completed', 'เสร็จสิ้น')
        )
      ORDER BY mb.month_key, p.name
    `;

    const rawRows = await dbClient.execute(query);

    const rows: DeadStockProductRow[] = Array.isArray(rawRows)
      ? (rawRows as unknown as DeadStockProductRow[])
      : [];

    const monthsByKey = new Map<
      string,
      {
        month_key: string;
        totals: {
          dead_products: number;
          dead_qty: number;
          dead_value: number;
        };
        products: Array<{
          product_id: number | null;
          product_name: string;
          dead_qty: number;
          dead_value: number;
        }>;
      }
    >();

    for (let offset = 0; offset < 12; offset += 1) {
      const current = new Date(start.getFullYear(), start.getMonth() + offset, 1);
      const key = formatMonthKey(current);
      monthsByKey.set(key, {
        month_key: key,
        totals: {
          dead_products: 0,
          dead_qty: 0,
          dead_value: 0,
        },
        products: [],
      });
    }

    const clampNumber = (value: unknown): number => {
      if (typeof value === "number") {
        return Number.isFinite(value) ? value : 0;
      }
      if (typeof value === "string" && value.trim().length > 0) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
      }
      return 0;
    };

    for (const row of rows) {
      const monthKey = row.month_key;
      if (typeof monthKey !== "string") {
        continue;
      }

      const monthEntry = monthsByKey.get(monthKey);
      if (!monthEntry) {
        continue;
      }

      const productId = clampNumber(row.product_id);
      const productName =
        typeof row.product_name === "string" && row.product_name.trim().length > 0
          ? row.product_name.trim()
          : `สินค้า #${productId || "ไม่ระบุ"}`;

      const deadQty = clampNumber(row.dead_qty);
      const deadValue = clampNumber(row.dead_value);

      monthEntry.products.push({
        product_id: Number.isFinite(productId) ? productId : null,
        product_name: productName,
        dead_qty: deadQty,
        dead_value: deadValue,
      });

      monthEntry.totals.dead_products += 1;
      monthEntry.totals.dead_qty += deadQty;
      monthEntry.totals.dead_value += deadValue;
    }

    const months = Array.from(monthsByKey.values());

    const latestMonth = months.at(-1) ?? null;
    const previousMonth = months.length >= 2 ? months.at(-2) ?? null : null;

    const computeDiff = (
      current: number,
      previous: number | undefined | null
    ): {
      absolute: number;
      percent: number | null;
    } => {
      const currentValue = Number.isFinite(current) ? current : 0;
      const previousValue =
        typeof previous === "number" && Number.isFinite(previous) ? previous : 0;

      const absolute = currentValue - previousValue;

      if (previousValue === 0) {
        return {
          absolute,
          percent: currentValue === 0 ? 0 : null,
        };
      }

      return {
        absolute,
        percent: ((currentValue - previousValue) / Math.abs(previousValue)) * 100,
      };
    };

    const latestSummary = latestMonth
      ? {
          month_key: latestMonth.month_key,
          totals: latestMonth.totals,
          products: latestMonth.products,
          compare_to_previous: previousMonth
            ? {
                dead_products: computeDiff(
                  latestMonth.totals.dead_products,
                  previousMonth?.totals.dead_products
                ),
                dead_qty: computeDiff(
                  latestMonth.totals.dead_qty,
                  previousMonth?.totals.dead_qty
                ),
                dead_value: computeDiff(
                  latestMonth.totals.dead_value,
                  previousMonth?.totals.dead_value
                ),
              }
            : null,
        }
      : null;

    res.json({ months, latest: latestSummary });
  } catch (error) {
    next(error);
  }
});

//Top Sellers
router.get("/products/top-sellers", async (_req, res, next) => {
  try {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const rows = await dbClient
      .select({
        productId: products.id,
        productName: products.name,
        company: products.company,
        totalQuantity: sql<number>`COALESCE(SUM(COALESCE(${order_items.quantity}, 0)), 0)`,
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
      )
      .groupBy(products.id, products.name, products.company)
      .orderBy(sql`COALESCE(SUM(COALESCE(${order_items.quantity}, 0)), 0) DESC`)
      .limit(6);

    const productsByQuantity = rows.map((row) => {
      const totalQuantity = Number(row.totalQuantity ?? 0);
      const trimmedName = row.productName?.trim() || row.company?.trim() || "ไม่ระบุสินค้า";
      const company = row.company?.trim() ?? null;

      return {
        productId: row.productId,
        name: trimmedName,
        productName: trimmedName,
        company,
        totalQuantity,
        quantitySold: totalQuantity,
        orders: totalQuantity,
      };
    });

    res.json({
      range: {
        start: start.toISOString(),
        end: end.toISOString(),
      },
      products: productsByQuantity,
    });
  } catch (error) {
    next(error);
  }
});

//todo


export default router;
