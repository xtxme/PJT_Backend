import type { RequestHandler } from "express";
import { asc, eq, like, or, sql } from "drizzle-orm";
import { dbClient } from "@db/client.js";
import { categories, products } from "@db/schema.js";

type RawProductRow = {
  productId: string;
  productCode: string;
  productName: string;
  sellPrice: string | number;
  quantity: number;
  productStatus: string;
  updatedAt: Date | null;
  lastCountedAt: Date | null;
  categoryName: string | null;
  lastStockStatus: string | null;
  lastStockUpdate: Date | null;
  lastSupplierName: string | null;
};

type OwnerProductResponse = {
  productId: string;
  productCode: string;
  productName: string;
  sellPrice: string;
  quantity: number;
  productStatus: string;
  categoryName: string | null;
  lastStockStatus: string | null;
  lastStockUpdate: Date | null;
  supplierName: string | null;
  updatedAt: Date | null;
  lastCountedAt: Date | null;
};

const normalizeDecimalToString = (value: string | number): string => {
  if (typeof value === "number") {
    return value.toFixed(2);
  }

  if (typeof value === "string") {
    return value;
  }

  return "0";
};

const buildSearchCondition = (searchTerm: string) => {
  const keyword = `%${searchTerm}%`;
  return or(
    like(products.name, keyword),
    like(products.id, keyword),
    like(products.company, keyword)
  );
};

const mapRowToResponse = (row: RawProductRow): OwnerProductResponse => {
  const lastUpdateCandidate = row.lastStockUpdate ?? row.lastCountedAt ?? row.updatedAt ?? null;

  return {
    productId: row.productId,
    productCode: row.productCode,
    productName: row.productName,
    sellPrice: normalizeDecimalToString(row.sellPrice),
    quantity: Number(row.quantity) || 0,
    productStatus: row.productStatus,
    categoryName: row.categoryName,
    lastStockStatus: row.lastStockStatus,
    lastStockUpdate: lastUpdateCandidate,
    supplierName: row.lastSupplierName,
    updatedAt: row.updatedAt,
    lastCountedAt: row.lastCountedAt,
  };
};

export const listProducts: RequestHandler = async (req, res, next) => {
  try {
    const { q } = req.query;

    const searchTerm = typeof q === "string" ? q.trim() : "";
    const searchCondition = searchTerm.length > 0 ? buildSearchCondition(searchTerm) : undefined;

    const baseQuery = dbClient
      .select({
        productId: products.id,
        productCode: products.id,
        productName: products.name,
        sellPrice: products.sell,
        quantity: products.quantity,
        productStatus: products.product_status,
        updatedAt: products.updated_at,
        lastCountedAt: products.last_counted_at,
        categoryName: categories.name,
        lastStockStatus: sql<string | null>`(
          SELECT si.stock_in_status
          FROM stock_in AS si
          WHERE si.product_id = ${products.id}
          ORDER BY si.received_date DESC, si.id DESC
          LIMIT 1
        )`,
        lastStockUpdate: sql<Date | null>`(
          SELECT si.received_date
          FROM stock_in AS si
          WHERE si.product_id = ${products.id}
          ORDER BY si.received_date DESC, si.id DESC
          LIMIT 1
        )`,
        lastSupplierName: sql<string | null>`(
          SELECT sup.company_name
          FROM stock_in AS si
          LEFT JOIN stock_in_batches AS sib ON sib.id = si.batch_id
          LEFT JOIN suppliers AS sup ON sup.id = COALESCE(si.supplier_id, sib.supplier_id)
          WHERE si.product_id = ${products.id}
          ORDER BY si.received_date DESC, si.id DESC
          LIMIT 1
        )`,
      })
      .from(products)
      .leftJoin(categories, eq(products.category_id, categories.id));

    const rowsQuery = searchCondition ? baseQuery.where(searchCondition) : baseQuery;

    const rows = (await rowsQuery.orderBy(asc(products.name))) as RawProductRow[];

    const data = rows.map(mapRowToResponse);

    res.json({ data });
  } catch (error) {
    next(error);
  }
};
