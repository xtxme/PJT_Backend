// src/controllers/warehouse.controller.ts
import { Router } from "express";
import { dbClient } from "@db/client.js";
import {
    products,
    categories,
    suppliers,
    stock_in,
    stock_in_batches,
} from "@db/schema.js";
import { and, or, eq, inArray, lte, sql, like, desc, asc } from "drizzle-orm";
import { randomUUID } from "crypto";

const router = Router();

/* ----------------------------- helpers ----------------------------- */
function toInt(val: unknown, def = 0) {
    const n = Number(val);
    return Number.isFinite(n) ? n : def;
}
function toPositiveInt(val: unknown, def = 0) {
    const n = toInt(val, def);
    return n > 0 ? n : def;
}
function paginateParams(query: any) {
    const page = Math.max(1, toInt(query.page, 1));
    const pageSize = Math.min(100, Math.max(1, toInt(query.pageSize, 20)));
    const offset = (page - 1) * pageSize;
    return { page, pageSize, offset, limit: pageSize };
}
function parseSort(sort?: string) {
    if (!sort) return null;
    const [col, dir] = sort.split(".");
    const direction = (dir || "asc").toLowerCase() === "desc" ? "desc" : "asc";
    const map: Record<string, any> = {
        name: products.name,
        quantity: products.quantity,
        updated_at: products.updated_at,
        created_at: products.created_at,
    };
    const column = map[col];
    if (!column) return null;
    return direction === "desc" ? desc(column) : asc(column);
}
function toMoneyString(v: unknown): string {
    const n = Number(v);
    if (!Number.isFinite(n)) throw new Error("unit_cost ไม่ถูกต้อง");
    return n.toFixed(2);
}

/** enum guards for drizzle mysql */
const PRODUCT_STATUSES = ["active", "low_stock", "restock_pending", "pricing_pending"] as const;
type ProductStatus = typeof PRODUCT_STATUSES[number];
function parseProductStatuses(raw?: string): ProductStatus[] {
    if (!raw) return [];
    const set = new Set(PRODUCT_STATUSES);
    return raw
        .split(",")
        .map((s) => s.trim())
        .filter((s): s is ProductStatus => set.has(s as ProductStatus));
}
const BATCH_STATUSES = ["pending", "some_received", "completed", "canceled"] as const;
type BatchStatus = typeof BATCH_STATUSES[number];
function parseBatchStatus(s?: string): BatchStatus | null {
    if (!s) return null;
    return (BATCH_STATUSES as readonly string[]).includes(s as BatchStatus) ? (s as BatchStatus) : null;
}


/* ============================
   1) Products: low-stock (แก้ enum + inArray)
============================ */
router.get("/products/low-stock", async (req, res, next) => {
    try {
        const { lte: lteStr, status, match = "any", q, category_id } = req.query as any;
        const { page, pageSize, offset, limit } = paginateParams(req.query);
        const lteQty = lteStr ? toInt(lteStr, NaN) : NaN;

        const statusValues = parseProductStatuses(status as string | undefined);

        if (Number.isNaN(lteQty) && statusValues.length === 0) {
            return res.status(400).json({
                message:
                    "ต้องระบุอย่างน้อยหนึ่งเงื่อนไข: lte (จำนวนต่ำกว่า) หรือ status (คอมม่าคั่น)",
            });
        }

        const conds: any[] = [];
        const nConds: any[] = [];
        if (!Number.isNaN(lteQty)) nConds.push(lte(products.quantity, lteQty));
        if (statusValues.length) nConds.push(inArray(products.product_status, statusValues));
        if (nConds.length) conds.push(match === "all" ? and(...nConds) : or(...nConds));

        if (q && String(q).trim()) {
            const likeQ = `%${String(q).trim()}%`;
            conds.push(or(like(products.name, likeQ), like(products.company, likeQ)));
        }
        if (category_id) {
            conds.push(eq(products.category_id, toInt(category_id)));
        }

        const orderBy = parseSort(String(req.query.sort || "")) ?? asc(products.name);

        const [rows, [{ total }]] = await Promise.all([
            dbClient
                .select({
                    id: products.id,
                    name: products.name,
                    image: products.image,
                    quantity: products.quantity,
                    quantity_pending: products.quantity_pending,
                    cost: products.cost,
                    sell: products.sell,
                    product_status: products.product_status,
                    category_id: products.category_id,
                    company: products.company,
                    updated_at: products.updated_at,
                })
                .from(products)
                .where(conds.length ? and(...conds) : undefined)
                .orderBy(orderBy)
                .limit(limit)
                .offset(offset),
            dbClient
                .select({ total: sql<number>`COUNT(*)` })
                .from(products)
                .where(conds.length ? and(...conds) : undefined),
        ]);

        res.json({ page, pageSize, total, data: rows });
    } catch (e) {
        next(e);
    }
});

/* ============================
   2) Stock-check: adjust (single + bulk) — เลี่ยงใช้ affectedRows
============================ */
router.patch("/products/:id/adjust-quantity", async (req, res, next) => {
    try {
        const { id } = req.params;
        const { quantity, note } = req.body || {};
        const qty = toInt(quantity, NaN);
        if (!Number.isFinite(qty) || qty < 0) {
            return res.status(400).json({ message: "quantity ต้องเป็นจำนวนเต็มไม่ติดลบ" });
        }

        // เช็คมีสินค้าไหมก่อน (เลี่ยงการใช้ affectedRows)
        const exists = await dbClient
            .select({ id: products.id })
            .from(products)
            .where(eq(products.id, id))
            .limit(1);

        if (exists.length === 0) {
            return res.status(404).json({ message: "ไม่พบสินค้า" });
        }

        await dbClient
            .update(products)
            .set({
                quantity: qty,
                counted_qty: qty,
                last_counted_at: new Date(),
                count_note: note ?? null,
                updated_at: new Date(),
            })
            .where(eq(products.id, id))
            .execute();

        res.json({ ok: true, id, quantity: qty });
    } catch (e) {
        next(e);
    }
});

router.post("/products", async (req, res, next) => {
    try {
        const {
            name,
            description,
            category_id,
            unit,
            cost,
            sell,
            company,
            image,
        } = req.body || {};

        if (!name || !String(name).trim()) {
            return res.status(400).json({ message: "ต้องระบุชื่อสินค้า" });
        }

        const data = {
            id: randomUUID(),
            name: String(name).trim(),
            description: description ?? null,
            category_id: category_id ? Number(category_id) : null,
            unit: unit ? String(unit).trim() : null,
            cost: cost != null ? String(Number(cost).toFixed(2)) : "0.00",
            sell: sell != null ? String(Number(sell).toFixed(2)) : "0.00",
            company: company ? String(company).trim() : null,
            image: image ? String(image).trim() : null,
        };

        await dbClient.insert(products).values(data).execute();

        res.status(201).json({
            id: data.id,
            name: data.name,
            category_id: data.category_id,
            unit: data.unit,
            cost: data.cost,
            sell: data.sell,
        });
    } catch (e) {
        next(e);
    }
});

// --- ดูรายการสินค้าแบบง่าย (ไว้เช็ก id) ---
router.get("/products", async (_req, res, next) => {
    try {
        const rows = await dbClient
            .select({
                id: products.id,
                name: products.name,
                image: products.image,
                quantity: products.quantity,
                quantity_pending: products.quantity_pending,
                cost: products.cost,
                sell: products.sell,
                product_status: products.product_status,
                created_at: products.created_at,
            })
            .from(products)
            .orderBy(asc(products.name));

        res.json(rows);
    } catch (e) {
        next(e);
    }
});

router.patch("/products/:id/cost", async (req, res, next) => {
    try {
        const id = String(req.params.id ?? "").trim();
        const { cost, supplier_id } = req.body ?? {};

        if (!id) {
            return res.status(400).json({ message: "Invalid product id" });
        }
        const numCost = Number(cost);
        if (!Number.isFinite(numCost) || numCost < 0) {
            return res.status(400).json({ message: "Invalid cost" });
        }

        // ถ้ามี supplier_id ให้ตรวจสอบความถูกต้อง (optional แต่แนะนำ)
        let supId: number | null = null;
        if (supplier_id != null) {
            const sId = Number(supplier_id);
            if (!Number.isFinite(sId) || sId <= 0) {
                return res.status(400).json({ message: "Invalid supplier_id" });
            }
            const [exists] = await dbClient
                .select({ c: sql<number>`COUNT(*)`.mapWith(Number) })
                .from(suppliers)
                .where(eq(suppliers.id, sId))
                .limit(1);
            if (!exists || !exists.c) {
                return res.status(404).json({ message: "Supplier not found" });
            }
            supId = sId;
        }

        const costStr = Number(numCost).toFixed(2);
        await dbClient
            .update(products)
            .set({
                cost: costStr,
                ...(supId ? { supplier_id: supId } : {}),
                updated_at: new Date(),
            })
            .where(eq(products.id, id)); // ✅ ใช้ number ตรง type

        return res.json({ ok: true, product_id: id, cost: numCost, supplier_id: supId ?? null });
    } catch (e) {
        next(e);
    }
});


/** อัปเดตต้นทุนแบบ bulk: [{product_id, cost}] */
/** อัปเดตต้นทุนแบบ bulk: { supplier_id?, items: [{ product_id, cost, supplier_id? }] } */
/** body: { supplier_id?: number, items: Array<{ product_id: string, cost: number, supplier_id?: number | null }> } */
router.post("/products/cost-bulk", async (req, res, next) => {
    try {
        const body = req.body ?? {};
        const topSupplierIdRaw = body.supplier_id;
        const items: Array<{ product_id: string; cost: number; supplier_id?: number | null }> =
            Array.isArray(body.items) ? body.items : [];

        if (items.length === 0) return res.status(400).json({ message: "No items" });

        for (const it of items) {
            const pid = String(it.product_id ?? "").trim();            // ✅ string
            if (!pid) return res.status(400).json({ message: "Invalid product_id: empty" });
            if (!Number.isFinite(it.cost) || it.cost < 0) {
                return res.status(400).json({ message: `Invalid cost for product ${pid}` });
            }
        }

        const supplierIds = new Set<number>();
        if (topSupplierIdRaw != null) {
            const s = Number(topSupplierIdRaw);
            if (!Number.isFinite(s) || s <= 0) return res.status(400).json({ message: "Invalid supplier_id" });
            supplierIds.add(s);
        }
        for (const it of items) {
            if (it.supplier_id != null) {
                const s = Number(it.supplier_id);
                if (!Number.isFinite(s) || s <= 0) {
                    return res.status(400).json({ message: `Invalid supplier_id for product ${it.product_id}` });
                }
                supplierIds.add(s);
            }
        }

        if (supplierIds.size > 0) {
            const ids = Array.from(supplierIds);
            const rows = await dbClient
                .select({ id: suppliers.id })
                .from(suppliers)
                .where(inArray(suppliers.id, ids));
            if (rows.length !== ids.length) return res.status(404).json({ message: "Some supplier(s) not found" });
        }

        for (const it of items) {
            const pid = String(it.product_id).trim();                   // ✅ string
            const costStr = Number(it.cost).toFixed(2);
            const effectiveSupplierId =
                it.supplier_id != null ? Number(it.supplier_id)
                    : (topSupplierIdRaw != null ? Number(topSupplierIdRaw) : null);

            await dbClient
                .update(products)
                .set({
                    cost: costStr,
                    ...(effectiveSupplierId ? { supplier_id: effectiveSupplierId } : {}),
                    updated_at: new Date(),
                })
                .where(eq(products.id, pid));                             // ✅ string
        }

        return res.json({ ok: true, updated: items.length });
    } catch (e) {
        next(e);
    }
});



router.post("/stock-check/adjust", async (req, res, next) => {
    try {
        const { items } = req.body || {};
        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ message: "items ต้องเป็น array ที่มีข้อมูล" });
        }

        await dbClient.transaction(async (tx) => {
            for (const it of items) {
                const qty = toInt(it.quantity, NaN);
                if (!it.product_id || !Number.isFinite(qty) || qty < 0) {
                    throw new Error("รูปแบบ items ไม่ถูกต้อง");
                }
                // มี/ไม่มี? ถ้าไม่มี ข้ามหรือ throw แล้วแต่ดีไซน์ — ที่นี่เลือก throw
                const check = await tx
                    .select({ id: products.id })
                    .from(products)
                    .where(eq(products.id, String(it.product_id)))
                    .limit(1);
                if (check.length === 0) throw new Error("ไม่พบ product_id: " + it.product_id);

                await tx
                    .update(products)
                    .set({
                        quantity: qty,
                        counted_qty: qty,
                        last_counted_at: new Date(),
                        count_note: it.note ?? null,
                        updated_at: new Date(),
                    })
                    .where(eq(products.id, String(it.product_id)))
                    .execute();
            }
        });

        res.json({ ok: true, count: items.length });
    } catch (e: any) {
        if (e?.message?.startsWith("ไม่พบ product_id")) {
            return res.status(404).json({ message: e.message });
        }
        next(e);
    }
});

/* ============================
   3) Dropdown: categories & suppliers (คงเดิม)
============================ */
router.get("/categories", async (req, res, next) => {
    try {
        const { q } = req.query as any;
        const { page, pageSize, offset, limit } = paginateParams(req.query);

        const cond =
            q && String(q).trim()
                ? like(categories.name, `%${String(q).trim()}%`)
                : undefined;

        const [rows, [{ total }]] = await Promise.all([
            dbClient
                .select({ id: categories.id, name: categories.name })
                .from(categories)
                .where(cond)
                .orderBy(asc(categories.name))
                .limit(limit)
                .offset(offset),
            dbClient
                .select({ total: sql<number>`COUNT(*)` })
                .from(categories)
                .where(cond),
        ]);

        res.json({ page, pageSize, total, data: rows });
    } catch (e) {
        next(e);
    }
});

router.post("/categories", async (req, res, next) => {
    try {
        const { name } = req.body || {};
        if (!name || !String(name).trim()) {
            return res.status(400).json({ message: "ต้องระบุชื่อหมวดหมู่" });
        }

        const result = await dbClient
            .insert(categories)
            .values({ name: String(name).trim() })
            .$returningId();

        res.status(201).json({ id: result[0].id, name });
    } catch (e: any) {
        if (e?.message?.includes("Duplicate entry")) {
            return res.status(409).json({ message: "มีชื่อหมวดหมู่นี้อยู่แล้ว" });
        }
        next(e);
    }
});

router.get("/suppliers", async (req, res, next) => {
    try {
        const { q } = req.query as any;
        const { page, pageSize, offset, limit } = paginateParams(req.query);

        const likeQ = q && String(q).trim() ? `%${String(q).trim()}%` : null;
        const cond =
            likeQ != null
                ? or(
                    like(suppliers.company_name, likeQ),
                    like(suppliers.email, likeQ),
                    like(suppliers.tel, likeQ)
                )
                : undefined;

        const [rows, [{ total }]] = await Promise.all([
            dbClient
                .select({
                    id: suppliers.id,
                    company_name: suppliers.company_name,
                    email: suppliers.email,
                    tel: suppliers.tel,
                })
                .from(suppliers)
                .where(cond)
                .orderBy(asc(suppliers.company_name))
                .limit(limit)
                .offset(offset),
            dbClient
                .select({ total: sql<number>`COUNT(*)` })
                .from(suppliers)
                .where(cond),
        ]);

        res.json({ page, pageSize, total, data: rows });
    } catch (e) {
        next(e);
    }
});

router.post("/suppliers", async (req, res, next) => {
    try {
        const { company_name, email, tel } = req.body || {};
        if (!company_name || !String(company_name).trim()) {
            return res.status(400).json({ message: "ต้องระบุชื่อบริษัทซัพพลายเออร์" });
        }

        const result = await dbClient
            .insert(suppliers)
            .values({
                company_name: String(company_name).trim(),
                email: email ? String(email).trim() : null,
                tel: tel ? String(tel).trim() : null,
            })
            .$returningId();

        res.status(201).json({
            id: result[0].id,
            company_name,
            email,
            tel,
        });
    } catch (e: any) {
        if (e?.message?.includes("Duplicate entry")) {
            return res.status(409).json({ message: "ซัพพลายเออร์นี้มีอยู่แล้ว" });
        }
        next(e);
    }
});

/* ============================
   4) Stock-in: batches & items
   - ตัด .returning()
   - ใช้ insertId
   - แก้ enum filter
============================ */
// สร้างบิลสั่งเข้า + รายการ
// สร้างบิลสั่งเข้า + รายการ (เวอร์ชันแก้ insertId -> $returningId)
router.post("/stock-in/batches", async (req, res, next) => {
    try {
        const { supplier_id, expected_date, note, items } = req.body || {};
        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ message: "items ต้องเป็น array ที่มีอย่างน้อย 1 รายการ" });
        }

        // เตรียมข้อมูล + validate
        const supId = supplier_id != null ? toInt(supplier_id, NaN) : null;
        const cleanItems = items.map((it: any, i: number) => {
            const qty = toPositiveInt(it.qty, NaN);
            const unitCostNum = Number(it.unit_cost);
            if (!it.product_id || !Number.isFinite(qty) || qty <= 0 || !Number.isFinite(unitCostNum)) {
                throw new Error(`รายการที่ ${i + 1} ไม่ถูกต้อง`);
            }
            return {
                product_id: String(it.product_id),
                quantity: qty,
                unit_cost_str: toMoneyString(unitCostNum), // DECIMAL -> string
                note: it.note ?? null,
            };
        });

        // 1) สร้างหัวบิลแล้วเอา id แบบ $returningId (กัน NaN)
        const batchIdRows = await dbClient
            .insert(stock_in_batches)
            .values({
                supplier_id: Number.isFinite(supId) ? supId : null,
                expected_date: expected_date ? new Date(expected_date) : null,
                note: note ?? null,
            })
            .$returningId(); // ✅ ใช้ helper ของ Drizzle MySQL

        const batchId = batchIdRows?.[0]?.id;
        if (!Number.isFinite(batchId)) {
            return res.status(500).json({ message: "สร้างบิลไม่สำเร็จ: batchId ว่าง" });
        }

        // 2) ใส่รายการ + อัปเดต pending ภายใต้ transaction
        const result = await dbClient.transaction(async (tx) => {
            const createdItems: Array<{
                item_id: number;
                product_id: string;
                quantity: number;
                unit_cost: string;
                stock_in_status: "pending";
            }> = [];

            for (const it of cleanItems) {
                const payload: typeof stock_in.$inferInsert = {
                    batch_id: Number(batchId),                 // int
                    product_id: it.product_id,                 // uuid string
                    quantity: it.quantity,                     // int
                    received_qty: 0,                           // int
                    unit_cost: it.unit_cost_str,               // DECIMAL string
                    supplier_id: Number.isFinite(supId) ? supId : null,
                    note: it.note,
                    // stock_in_status: default 'pending'
                };

                const itemRows = await tx.insert(stock_in).values(payload).$returningId(); // ✅
                const itemId = itemRows?.[0]?.id;

                createdItems.push({
                    item_id: Number(itemId),
                    product_id: it.product_id,
                    quantity: it.quantity,
                    unit_cost: it.unit_cost_str,               // ✅ คืนเป็น string
                    stock_in_status: "pending",
                });

                await tx
                    .update(products)
                    .set({
                        quantity_pending: sql`${products.quantity_pending} + ${it.quantity}`,
                        updated_at: new Date(),
                    })
                    .where(eq(products.id, it.product_id))
                    .execute();
            }

            return { batch_id: Number(batchId), items: createdItems };
        });

        res.status(201).json({
            batch_id: result.batch_id,
            batch_status: "pending",
            items: result.items,
        });
    } catch (e) {
        next(e);
    }
});


// ลิสต์บิล (แก้ enum)
router.get("/stock-in/batches", async (req, res, next) => {
    try {
        const { status, supplier_id, date_from, date_to, q } = req.query as any;
        const { page, pageSize, offset, limit } = paginateParams(req.query);

        const conds: any[] = [];
        const st = parseBatchStatus(status);
        if (st) conds.push(eq(stock_in_batches.batch_status, st));
        if (supplier_id) conds.push(eq(stock_in_batches.supplier_id, toInt(supplier_id)));
        if (date_from) conds.push(sql`${stock_in_batches.created_at} >= ${new Date(String(date_from))}`);
        if (date_to) conds.push(sql`${stock_in_batches.created_at} <= ${new Date(String(date_to))}`);
        if (q && String(q).trim()) conds.push(like(stock_in_batches.note, `%${String(q).trim()}%`));

        const where = conds.length ? and(...conds) : undefined;

        const [rows, [{ total }]] = await Promise.all([
            dbClient
                .select({
                    id: stock_in_batches.id,
                    supplier_id: stock_in_batches.supplier_id,
                    batch_status: stock_in_batches.batch_status,
                    expected_date: stock_in_batches.expected_date,
                    note: stock_in_batches.note,
                    created_at: stock_in_batches.created_at,
                    updated_at: stock_in_batches.updated_at,
                })
                .from(stock_in_batches)
                .where(where)
                .orderBy(desc(stock_in_batches.created_at))
                .limit(limit)
                .offset(offset),
            dbClient
                .select({ total: sql<number>`COUNT(*)` })
                .from(stock_in_batches)
                .where(where),
        ]);

        res.json({ page, pageSize, total, data: rows });
    } catch (e) {
        next(e);
    }
});

// รายละเอียดบิล + รายการ (เดิมใช้ได้)
router.get("/stock-in/batches/:batchId", async (req, res, next) => {
    try {
        const batchId = toInt(req.params.batchId, NaN);
        if (!Number.isFinite(batchId)) return res.status(400).json({ message: "batchId ไม่ถูกต้อง" });

        const [batch] = await dbClient
            .select({
                id: stock_in_batches.id,
                supplier_id: stock_in_batches.supplier_id,
                batch_status: stock_in_batches.batch_status,
                expected_date: stock_in_batches.expected_date,
                note: stock_in_batches.note,
                created_at: stock_in_batches.created_at,
                updated_at: stock_in_batches.updated_at,
            })
            .from(stock_in_batches)
            .where(eq(stock_in_batches.id, batchId))
            .limit(1);

        if (!batch) return res.status(404).json({ message: "ไม่พบบิล" });

        const items = await dbClient
            .select({
                item_id: stock_in.id,
                product_id: stock_in.product_id,
                name: products.name,
                quantity: stock_in.quantity,
                received_qty: stock_in.received_qty,
                unit_cost: stock_in.unit_cost,
                stock_in_status: stock_in.stock_in_status,
                received_date: stock_in.received_date,
                note: stock_in.note,
            })
            .from(stock_in)
            .leftJoin(products, eq(products.id, stock_in.product_id))
            .where(eq(stock_in.batch_id, batchId));

        res.json({ ...batch, items });
    } catch (e) {
        next(e);
    }
});

// ยกเลิกทั้งบิล (ห้ามมีรายการที่เริ่มรับแล้ว)
router.patch("/stock-in/batches/:batchId/cancel", async (req, res, next) => {
    try {
        const batchId = toInt(req.params.batchId, NaN);
        if (!Number.isFinite(batchId)) return res.status(400).json({ message: "batchId ไม่ถูกต้อง" });

        await dbClient.transaction(async (tx) => {
            const items = await tx
                .select({
                    id: stock_in.id,
                    product_id: stock_in.product_id,
                    quantity: stock_in.quantity,
                    received_qty: stock_in.received_qty,
                    status: stock_in.stock_in_status,
                })
                .from(stock_in)
                .where(eq(stock_in.batch_id, batchId));

            if (items.length === 0) throw new Error("ไม่พบรายการในบิล");

            const anyReceived = items.some((i) => i.received_qty > 0);
            if (anyReceived) throw new Error("ยกเลิกไม่ได้: มีรายการที่เริ่มรับแล้ว");

            for (const it of items) {
                await tx
                    .update(stock_in)
                    .set({ stock_in_status: "canceled" })
                    .where(eq(stock_in.id, it.id))
                    .execute();

                await tx
                    .update(products)
                    .set({
                        quantity_pending: sql`${products.quantity_pending} - ${it.quantity}`,
                        updated_at: new Date(),
                    })
                    .where(eq(products.id, it.product_id))
                    .execute();
            }

            await tx
                .update(stock_in_batches)
                .set({ batch_status: "canceled", updated_at: new Date() })
                .where(eq(stock_in_batches.id, batchId))
                .execute();
        });

        res.json({ ok: true, batch_id: batchId, batch_status: "canceled" });
    } catch (e: any) {
        if (e?.message?.startsWith("ยกเลิกไม่ได้")) {
            return res.status(409).json({ message: e.message });
        }
        next(e);
    }
});

// แก้ qty/unit_cost ของ item (ถ้ายังไม่เริ่มรับ)
router.patch("/stock-in/items/:itemId", async (req, res, next) => {
    try {
        const itemId = toInt(req.params.itemId, NaN);
        if (!Number.isFinite(itemId)) return res.status(400).json({ message: "itemId ไม่ถูกต้อง" });

        const { quantity, unit_cost, note } = req.body || {};
        const newQty = quantity == null ? null : toPositiveInt(quantity, NaN);
        const newCost = unit_cost == null ? null : Number(unit_cost);

        await dbClient.transaction(async (tx) => {
            const [row] = await tx
                .select({
                    id: stock_in.id,
                    product_id: stock_in.product_id,
                    quantity: stock_in.quantity,
                    received_qty: stock_in.received_qty,
                    unit_cost: stock_in.unit_cost,
                })
                .from(stock_in)
                .where(eq(stock_in.id, itemId))
                .limit(1);

            if (!row) throw new Error("ไม่พบรายการ");
            if (row.received_qty > 0) throw new Error("แก้ไม่ได้: รายการเริ่มรับแล้ว");

            const updates: any = {};
            if (newQty != null) {
                if (!Number.isFinite(newQty) || newQty <= 0) throw new Error("quantity ไม่ถูกต้อง");
                const diff = newQty - row.quantity;
                updates.quantity = newQty;

                if (diff !== 0) {
                    await tx
                        .update(products)
                        .set({
                            quantity_pending: sql`${products.quantity_pending} + ${diff}`,
                            updated_at: new Date(),
                        })
                        .where(eq(products.id, row.product_id))
                        .execute();
                }
            }
            if (newCost != null) {
                if (!Number.isFinite(newCost)) throw new Error("unit_cost ไม่ถูกต้อง");
                updates.unit_cost = newCost;
            }
            if (note !== undefined) updates.note = note ?? null;

            if (Object.keys(updates).length === 0) return;

            await tx.update(stock_in).set(updates).where(eq(stock_in.id, itemId)).execute();
        });

        res.json({ ok: true, item_id: itemId });
    } catch (e: any) {
        if (e?.message?.startsWith("แก้ไม่ได้")) {
            return res.status(409).json({ message: e.message });
        }
        next(e);
    }
});

// รับของ (partial)
router.post("/stock-in/items/:itemId/receive", async (req, res, next) => {
    try {
        const itemId = toInt(req.params.itemId, NaN);
        const receiveQty = toPositiveInt(req.body?.receive_qty, NaN);
        if (!Number.isFinite(itemId)) return res.status(400).json({ message: "itemId ไม่ถูกต้อง" });
        if (!Number.isFinite(receiveQty) || receiveQty <= 0) {
            return res.status(400).json({ message: "receive_qty ต้องมากกว่า 0" });
        }

        const result = await dbClient.transaction(async (tx) => {
            const [row] = await tx.select().from(stock_in).where(eq(stock_in.id, itemId)).limit(1);
            if (!row) throw new Error("ไม่พบรายการ");

            const remain = row.quantity - row.received_qty;
            if (receiveQty > remain) throw new Error("receive_qty เกินจำนวนที่เหลือ");

            const newReceived = row.received_qty + receiveQty;
            const completed = newReceived === row.quantity;

            await tx
                .update(stock_in)
                .set({
                    received_qty: newReceived,
                    stock_in_status: completed ? "completed" : "some_received",
                    received_date: completed ? new Date() : row.received_date,
                })
                .where(eq(stock_in.id, itemId))
                .execute();

            await tx
                .update(products)
                .set({
                    quantity: sql`${products.quantity} + ${receiveQty}`,
                    quantity_pending: sql`${products.quantity_pending} - ${receiveQty}`,
                    cost: row.unit_cost,
                    updated_at: new Date(),
                })
                .where(eq(products.id, row.product_id))
                .execute();

            const items = await tx
                .select({
                    quantity: stock_in.quantity,
                    received_qty: stock_in.received_qty,
                    status: stock_in.stock_in_status,
                })
                .from(stock_in)
                .where(eq(stock_in.batch_id, row.batch_id));

            const all = items.length;
            const completedCount = items.filter((i) => i.received_qty === i.quantity).length;
            const anyReceived = items.some((i) => i.received_qty > 0);
            const batchStatus: BatchStatus =
                completedCount === all ? "completed" : anyReceived ? "some_received" : "pending";

            await tx
                .update(stock_in_batches)
                .set({ batch_status: batchStatus, updated_at: new Date() })
                .where(eq(stock_in_batches.id, row.batch_id))
                .execute();

            return { completed, batch_status: batchStatus };
        });

        res.json({ ok: true, item_id: itemId, completed: result.completed, batch_status: result.batch_status });
    } catch (e: any) {
        if (e?.message?.includes("เกินจำนวน")) {
            return res.status(400).json({ message: e.message });
        }
        next(e);
    }
});

// ยกเลิกรายการเดี่ยว (ยังไม่รับของ)
router.patch("/stock-in/items/:itemId/cancel", async (req, res, next) => {
    try {
        const itemId = toInt(req.params.itemId, NaN);
        if (!Number.isFinite(itemId)) return res.status(400).json({ message: "itemId ไม่ถูกต้อง" });

        await dbClient.transaction(async (tx) => {
            const [row] = await tx.select().from(stock_in).where(eq(stock_in.id, itemId)).limit(1);
            if (!row) throw new Error("ไม่พบรายการ");
            if (row.received_qty > 0) throw new Error("ยกเลิกไม่ได้: รายการเริ่มรับแล้ว");

            await tx
                .update(stock_in)
                .set({ stock_in_status: "canceled" })
                .where(eq(stock_in.id, itemId))
                .execute();

            await tx
                .update(products)
                .set({
                    quantity_pending: sql`${products.quantity_pending} - ${row.quantity}`,
                    updated_at: new Date(),
                })
                .where(eq(products.id, row.product_id))
                .execute();

            const items = await tx
                .select({ status: stock_in.stock_in_status })
                .from(stock_in)
                .where(eq(stock_in.batch_id, row.batch_id));

            const allCanceled = items.length > 0 && items.every((i) => i.status === "canceled");
            const anyReceived = items.some(
                (i) => i.status === "some_received" || i.status === "completed"
            );
            const batchStatus: BatchStatus = allCanceled ? "canceled" : anyReceived ? "some_received" : "pending";

            await tx
                .update(stock_in_batches)
                .set({ batch_status: batchStatus, updated_at: new Date() })
                .where(eq(stock_in_batches.id, row.batch_id))
                .execute();
        });

        res.json({ ok: true, item_id: itemId, status: "canceled" });
    } catch (e: any) {
        if (e?.message?.startsWith("ยกเลิกไม่ได้")) {
            return res.status(409).json({ message: e.message });
        }
        next(e);
    }
});

// รายการค้างรับ (To-Receive)
router.get("/stock-in/open", async (_req, res, next) => {
    try {
        const rows = await dbClient
            .select({
                batch_id: stock_in.batch_id,
                item_id: stock_in.id,
                product_id: stock_in.product_id,
                name: products.name,
                ordered_qty: stock_in.quantity,
                received_qty: stock_in.received_qty,
                remain: sql<number>`${stock_in.quantity} - ${stock_in.received_qty}`,
                unit_cost: stock_in.unit_cost,
                supplier_id: stock_in.supplier_id,
                expected_date: stock_in_batches.expected_date,
                status: stock_in.stock_in_status,
            })
            .from(stock_in)
            .innerJoin(stock_in_batches, eq(stock_in_batches.id, stock_in.batch_id))
            .leftJoin(products, eq(products.id, stock_in.product_id))
            .where(inArray(stock_in.stock_in_status, ["pending", "some_received"]))
            .orderBy(asc(stock_in_batches.expected_date), asc(products.name));

        res.json(rows);
    } catch (e) {
        next(e);
    }
});

export default router;
