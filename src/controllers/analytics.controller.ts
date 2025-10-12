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

//todo
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

//todo


export default router;
