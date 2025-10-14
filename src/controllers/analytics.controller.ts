import { Router } from "express";
import { and, eq, gte, inArray, lt, sql, isNotNull } from "drizzle-orm";
import { dbClient } from "@db/client.js";
import { orders, order_items, products, stock_in, stock_in_batches, employee, customers, suppliers } from "@db/schema.js";

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
        inArray(orders.order_status, completedOrderStatuses)
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

const BANGKOK_TIME_ZONE = "Asia/Bangkok";
const BANGKOK_OFFSET_MINUTES = 7 * 60;

const bangkokMonthFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: BANGKOK_TIME_ZONE,
  year: "numeric",
  month: "numeric",
});

type BangkokYearMonth = {
  year: number;
  monthIndex: number;
};

const getBangkokYearMonth = (referenceDate: Date): BangkokYearMonth => {
  const parts = bangkokMonthFormatter.formatToParts(referenceDate);
  const yearPart = parts.find((part) => part.type === "year");
  const monthPart = parts.find((part) => part.type === "month");

  const fallbackYear = referenceDate.getUTCFullYear();
  const fallbackMonthIndex = referenceDate.getUTCMonth();

  const parsedYear = Number.parseInt(yearPart?.value ?? "", 10);
  const parsedMonth = Number.parseInt(monthPart?.value ?? "", 10);

  const year = Number.isNaN(parsedYear) ? fallbackYear : parsedYear;
  const monthIndex = Number.isNaN(parsedMonth) ? fallbackMonthIndex : parsedMonth - 1;

  return { year, monthIndex };
};

const createBangkokMonthStartDate = (year: number, monthIndex: number) => {
  const utcDate = new Date(Date.UTC(year, monthIndex, 1));
  // Align the timestamp with midnight in Asia/Bangkok (UTC+7)
  utcDate.setUTCMinutes(utcDate.getUTCMinutes() - BANGKOK_OFFSET_MINUTES);
  return utcDate;
};

const getBangkokMonthKeyFromParts = ({ year, monthIndex }: BangkokYearMonth) =>
  `${year}-${String(monthIndex + 1).padStart(2, "0")}`;

const getBangkokYearMonthWithOffset = (
  referenceDate: Date,
  offset: number
): BangkokYearMonth => {
  const { year, monthIndex } = getBangkokYearMonth(referenceDate);
  const totalMonths = year * 12 + monthIndex + offset;
  const targetYear = Math.floor(totalMonths / 12);
  const targetMonthIndex = totalMonths - targetYear * 12;

  return {
    year: targetYear,
    monthIndex: targetMonthIndex,
  };
};

const getBangkokMonthRangeFromOffset = (referenceDate: Date, offset: number): MonthRange => {
  const startParts = getBangkokYearMonthWithOffset(referenceDate, offset);
  const endParts = getBangkokYearMonthWithOffset(referenceDate, offset + 1);

  return {
    start: createBangkokMonthStartDate(startParts.year, startParts.monthIndex),
    end: createBangkokMonthStartDate(endParts.year, endParts.monthIndex),
  };
};

const getBangkokTrailingMonthsRange = (
  referenceDate: Date,
  months: number
): MonthRange => {
  if (months <= 0) {
    throw new Error("Months must be greater than zero");
  }

  const startParts = getBangkokYearMonthWithOffset(referenceDate, -(months - 1));
  const endParts = getBangkokYearMonthWithOffset(referenceDate, 1);

  return {
    start: createBangkokMonthStartDate(startParts.year, startParts.monthIndex),
    end: createBangkokMonthStartDate(endParts.year, endParts.monthIndex),
  };
};

const getCurrentBangkokMonthRange = (referenceDate: Date): MonthRange =>
  getBangkokMonthRangeFromOffset(referenceDate, 0);

async function getStockInMonthlySummary({ start, end }: MonthRange): Promise<StockInMonthlyRecord[]> {
  const rows = await dbClient
    .select({
      year: sql<number>`YEAR(${stock_in.received_date})`,
      month: sql<number>`MONTH(${stock_in.received_date})`,
      totalQuantity: sql<number>`COALESCE(SUM(COALESCE(${stock_in.received_qty}, 0)), 0)`,
      totalValue: sql<number>`COALESCE(SUM(COALESCE(${stock_in.received_qty}, 0) * COALESCE(${stock_in.unit_cost}, 0)), 0)`,
    })
    .from(stock_in)
    .innerJoin(stock_in_batches, eq(stock_in.batch_id, stock_in_batches.id))
    .where(
      and(
        isNotNull(stock_in.received_date),
        gte(stock_in.received_date, start),
        lt(stock_in.received_date, end),
        inArray(stock_in.stock_in_status, receivedStockInStatuses),
        inArray(stock_in_batches.batch_status, receivedStockInStatuses)
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
    const { year, monthIndex } = getBangkokYearMonthWithOffset(start, offset);
    const key = getBangkokMonthKeyFromParts({ year, monthIndex });
    const data = totalsByMonth.get(key);

    months.push({
      month: key,
      totalQuantity: data?.totalQuantity ?? 0,
      totalValue: data?.totalValue ?? 0,
    });
  }

  return months;
}

//กราฟแสดงภาพรวมยอดขาย
router.get("/sales/monthly-summary", async (_req, res, next) => {
  try {
    const now = new Date();
    const { start, end } = getBangkokTrailingMonthsRange(now, 12);

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
          inArray(orders.order_status, completedOrderStatuses)
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
      const { year, monthIndex } = getBangkokYearMonthWithOffset(start, offset);
      const key = getBangkokMonthKeyFromParts({ year, monthIndex });
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

//กราฟสรุปยอดการรับสินค้าจากซัพพลายเออร์
router.get("/stock-in/monthly-summary", async (_req, res, next) => {
  try {
    const now = new Date();
    const { start, end } = getBangkokTrailingMonthsRange(now, 12);

    const months = await getStockInMonthlySummary({ start, end });

    res.json({ months });
  } catch (error) {
    next(error);
  }
});

//สรุปยอดการรับสินค้าแบบตาราง
router.get("/stock-in/summary", async (_req, res, next) => {
  try {
    const now = new Date();
    const { start, end } = getBangkokTrailingMonthsRange(now, 12);

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
    const currentRange = getBangkokMonthRangeFromOffset(now, 0);
    const previousRange = getBangkokMonthRangeFromOffset(now, -1);

    const startOfMonth = currentRange.start;
    const startOfNextMonth = currentRange.end;
    const startOfPreviousMonth = previousRange.start;

    // 🔹 ยอดขายเดือนนี้ (เฉพาะ completed)
    const [result] = await dbClient
      .select({
        total: sql<number>`COALESCE(SUM(${orders.total_amount}), 0)`,
      })
      .from(orders)
      .where(
        and(
          gte(orders.order_date, startOfMonth),
          lt(orders.order_date, startOfNextMonth),
          eq(orders.order_status, "completed") // ✅ เฉพาะ complete
        )
      );

    // 🔹 ยอดขายเดือนที่แล้ว (เฉพาะ completed)
    const [previousResult] = await dbClient
      .select({
        total: sql<number>`COALESCE(SUM(${orders.total_amount}), 0)`,
      })
      .from(orders)
      .where(
        and(
          gte(orders.order_date, startOfPreviousMonth),
          lt(orders.order_date, startOfMonth),
          eq(orders.order_status, "completed") // ✅ เฉพาะ complete
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
    const currentRange = getBangkokMonthRangeFromOffset(now, 0);
    const startOfMonth = currentRange.start;
    const startOfNextMonth = currentRange.end;

    const monthKey = getBangkokMonthKeyFromParts(getBangkokYearMonth(now));

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
          inArray(orders.order_status, completedOrderStatuses)
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
    const currentRange = getBangkokMonthRangeFromOffset(now, 0);
    const previousRange = getBangkokMonthRangeFromOffset(now, -1);

    const startOfMonth = currentRange.start;
    const startOfNextMonth = currentRange.end;
    const startOfPreviousMonth = previousRange.start;

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

//ลูกค้าที่มียอดสั่งซื้อสูงสุด
router.get("/customers/top-order-value", async (_req, res, next) => {
  try {
    const now = new Date();
    const { start: startOfTargetMonth, end: startOfNextMonth } = getCurrentBangkokMonthRange(now);

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
          gte(orders.order_date, startOfTargetMonth),
          lt(orders.order_date, startOfNextMonth),
          inArray(orders.order_status, completedOrderStatuses)
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
        start: startOfTargetMonth.toISOString(),
        end: startOfNextMonth.toISOString(),
      },
      customers: result,
    });
  } catch (error) {
    next(error);
  }
});

//สรุปยอดการสั่งซื้อจากซัพพลายเออร์
router.get("/company/top-order-value", async (_req, res, next) => {
  try {
    const now = new Date();
    const { start, end } = getCurrentBangkokMonthRange(now);

    const rows = await dbClient
      .select({
        supplierId: suppliers.id,
        companyName: suppliers.company_name,
        totalPurchaseValue: sql<number>`COALESCE(SUM(COALESCE(${stock_in.received_qty}, 0) * COALESCE(${stock_in.unit_cost}, 0)), 0)`,
      })
      .from(stock_in)
      .innerJoin(stock_in_batches, eq(stock_in.batch_id, stock_in_batches.id))
      .leftJoin(suppliers, eq(stock_in.supplier_id, suppliers.id))
      .where(
        and(
          isNotNull(stock_in.received_date),
          gte(stock_in.received_date, start),
          lt(stock_in.received_date, end),
          inArray(stock_in.stock_in_status, receivedStockInStatuses),
          inArray(stock_in_batches.batch_status, receivedStockInStatuses)
        )
      )
      .groupBy(suppliers.id, suppliers.company_name)
      .orderBy(sql`COALESCE(SUM(COALESCE(${stock_in.received_qty}, 0) * COALESCE(${stock_in.unit_cost}, 0)), 0) DESC`)
      .limit(6);

    const companies = rows.map((row) => {
      const totalValue = Number(row.totalPurchaseValue ?? 0);
      const name = row.companyName?.trim() || "ไม่ระบุซัพพลายเออร์";

      return {
        company: name,
        name,
        totalOrderValue: totalValue,
        totalAmount: totalValue,
        value: totalValue,
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

//สินค้าค้างสต็อก
router.get("/dead-stock/monthly-summary", async (_req, res, next) => {
  try {
    const now = new Date();
    const { start, end } = getBangkokTrailingMonthsRange(now, 12);

    type DeadStockProductRow = {
      month_key: string;
      product_id: string | number | null;
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
            AND o.order_status IN ('completed', 'เสร็จสิ้น')
        )
      ORDER BY mb.month_key, p.name
    `;

    const [queryRows] = (await dbClient.execute(query)) as unknown as [
      DeadStockProductRow[] | undefined,
      unknown
    ];

    const rows: DeadStockProductRow[] = Array.isArray(queryRows) ? queryRows : [];

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
          product_id: string | null;
          product_name: string;
          dead_qty: number;
          dead_value: number;
        }>;
      }
    >();

    for (let offset = 0; offset < 12; offset += 1) {
      const { year, monthIndex } = getBangkokYearMonthWithOffset(start, offset);
      const key = getBangkokMonthKeyFromParts({ year, monthIndex });
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

    const coerceProductId = (value: unknown): string | null => {
      if (typeof value === "string") {
        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : null;
      }
      if (typeof value === "number" && Number.isFinite(value)) {
        return String(value);
      }
      return null;
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

      const productId = coerceProductId(row.product_id);
      const productName =
        typeof row.product_name === "string" && row.product_name.trim().length > 0
          ? row.product_name.trim()
          : `สินค้า #${productId ?? "ไม่ระบุ"}`;

      const deadQty = clampNumber(row.dead_qty);
      const deadValue = clampNumber(row.dead_value);

      monthEntry.products.push({
        product_id: productId,
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

//ยอดขายตามอันดับสินค้า
router.get("/products/top-sellers", async (req, res, next) => {
  try {
    const now = new Date();
    const rawMonth = Array.isArray(req.query.month) ? req.query.month.at(-1) : req.query.month;
    const rawYear = Array.isArray(req.query.year) ? req.query.year.at(-1) : req.query.year;

    const parsedMonth =
      typeof rawMonth === "string" ? Number.parseInt(rawMonth, 10) : Number.NaN;
    const parsedYear =
      typeof rawYear === "string" ? Number.parseInt(rawYear, 10) : Number.NaN;

    let targetParts: BangkokYearMonth;
    if (
      Number.isInteger(parsedYear) &&
      Number.isInteger(parsedMonth) &&
      parsedMonth >= 1 &&
      parsedMonth <= 12
    ) {
      targetParts = {
        year: parsedYear,
        monthIndex: parsedMonth - 1,
      };
    } else {
      targetParts = getBangkokYearMonth(now);
    }

    const startOfTargetMonth = createBangkokMonthStartDate(
      targetParts.year,
      targetParts.monthIndex
    );
    const startOfNextMonth = createBangkokMonthStartDate(
      targetParts.year,
      targetParts.monthIndex + 1
    );

    const rawLimit = Array.isArray(req.query.limit) ? req.query.limit.at(-1) : req.query.limit;
    const parsedLimit =
      typeof rawLimit === "string" ? Number.parseInt(rawLimit, 10) : Number.NaN;
    const limit = Number.isInteger(parsedLimit) && parsedLimit > 0 ? parsedLimit : 6;

    const rows = await dbClient
      .select({
        productUuid: products.id,
        productName: products.name,
        // productCompany: products.company,
        productImage: products.image,
        totalQuantity: sql<number>`COALESCE(SUM(COALESCE(${order_items.quantity}, 0)), 0)`,
      })
      .from(order_items)
      .innerJoin(orders, eq(order_items.order_id, orders.id))
      .innerJoin(products, eq(order_items.product_id, products.id))
      .where(
        and(
          gte(orders.order_date, startOfTargetMonth),
          lt(orders.order_date, startOfNextMonth),
          inArray(orders.order_status, completedOrderStatuses)
        )
      )
      .groupBy(products.id, products.name, products.image)
      .orderBy(sql`COALESCE(SUM(COALESCE(${order_items.quantity}, 0)), 0) DESC`)
      .limit(limit);

    const productsByQuantity = rows.map((row, index) => {
      const totalQuantity = Number(row.totalQuantity ?? 0);
      const trimmedName =
        row.productName?.trim() || "ไม่ระบุสินค้า";
      // const company = row.productCompany?.trim() ?? null;

      let numericProductId: number | null = null;
      if (typeof row.productUuid === "number") {
        numericProductId = Number.isFinite(row.productUuid) ? row.productUuid : null;
      } else if (typeof row.productUuid === "string") {
        const digitsMatch = row.productUuid.match(/\d+/);
        if (digitsMatch) {
          const parsed = Number.parseInt(digitsMatch[0], 10);
          numericProductId = Number.isFinite(parsed) ? parsed : null;
        }
      }

      const productId = numericProductId ?? index + 1;

      return {
        productId,
        id: productId,
        productUuid: row.productUuid,
        productCode: row.productUuid,
        name: trimmedName,
        productName: trimmedName,
        // company,
        image: row.productImage ?? null,
        totalQuantity,
        quantitySold: totalQuantity,
        orders: totalQuantity,
      };
    });

    res.json({
      range: {
        start: startOfTargetMonth.toISOString(),
        end: startOfNextMonth.toISOString(),
      },
      limit,
      products: productsByQuantity,
    });
  } catch (error) {
    next(error);
  }
});

//สินค้าขายดีประจำเดือน
router.get("/products/top-sellers-month", async (req, res, next) => {
  try {
    const parseDateParam = (value: unknown): Date | null => {
      if (typeof value !== "string" || value.trim().length === 0) {
        return null;
      }

      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    };

    const now = new Date();
    const { start: defaultStart, end: defaultEnd } = getCurrentBangkokMonthRange(now);

    const rawStart = Array.isArray(req.query.start) ? req.query.start.at(-1) : req.query.start;
    const rawEnd = Array.isArray(req.query.end) ? req.query.end.at(-1) : req.query.end;

    const parsedStart = parseDateParam(rawStart);
    const parsedEnd = parseDateParam(rawEnd);

    let rangeStart = defaultStart;
    let rangeExclusiveEnd = defaultEnd;

    if (parsedStart && parsedEnd) {
      rangeStart = parsedStart;
      rangeExclusiveEnd = parsedEnd;
      if (!(rangeStart.getTime() < rangeExclusiveEnd.getTime())) {
        rangeExclusiveEnd = new Date(rangeStart.getTime() + 24 * 60 * 60 * 1000);
      }
    } else if (parsedStart && !parsedEnd) {
      const { year, monthIndex } = getBangkokYearMonth(parsedStart);
      rangeStart = createBangkokMonthStartDate(year, monthIndex);
      rangeExclusiveEnd = createBangkokMonthStartDate(year, monthIndex + 1);
    } else if (!parsedStart && parsedEnd) {
      const adjustedEnd = parsedEnd;
      const { year, monthIndex } = getBangkokYearMonth(adjustedEnd);
      rangeStart = createBangkokMonthStartDate(year, monthIndex);
      rangeExclusiveEnd = adjustedEnd;
      if (!(rangeStart.getTime() < rangeExclusiveEnd.getTime())) {
        rangeExclusiveEnd = createBangkokMonthStartDate(year, monthIndex + 1);
      }
    }

    const rawLimit = Array.isArray(req.query.limit) ? req.query.limit.at(-1) : req.query.limit;
    const parsedLimit =
      typeof rawLimit === "string" ? Number.parseInt(rawLimit, 10) : Number.NaN;
    const limit = Number.isInteger(parsedLimit) && parsedLimit > 0 ? parsedLimit : 5;

    const rows = await dbClient
      .select({
        productId: products.id,
        productName: products.name,
        productImage: products.image,
        // productCompany: products.company,
        productCategoryId: products.category_id,
        totalSold: sql<number>`COALESCE(SUM(COALESCE(${order_items.quantity}, 0)), 0)`,
      })
      .from(order_items)
      .innerJoin(orders, eq(order_items.order_id, orders.id))
      .innerJoin(products, eq(order_items.product_id, products.id))
      .where(
        and(
          gte(orders.order_date, rangeStart),
          lt(orders.order_date, rangeExclusiveEnd),
          inArray(orders.order_status, completedOrderStatuses)
        )
      )
      .groupBy(
        products.id,
        products.name,
        products.image,
        // products.company,
        products.category_id
      )
      .orderBy(sql`COALESCE(SUM(COALESCE(${order_items.quantity}, 0)), 0) DESC`)
      .limit(limit);

    const productsBySales = rows.map((row, index) => {
      const totalSold = Number(row.totalSold ?? 0);
      const trimmedName = row.productName?.trim() || "ไม่ระบุสินค้า";

      return {
        rank: index + 1,
        productId: row.productId,
        productName: trimmedName,
        image: row.productImage ?? null,
        totalSold,
        // company: row.productCompany?.trim() ?? null,
        categoryId: row.productCategoryId == null ? null : Number(row.productCategoryId),
      };
    });

    res.json({
      range: {
        start: rangeStart.toISOString(),
        end: rangeExclusiveEnd.toISOString(),
      },
      limit,
      products: productsBySales,
    });
  } catch (error) {
    next(error);
  }
});


export default router;
