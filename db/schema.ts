import { sql } from "drizzle-orm";
import {
    mysqlTable, varchar, text, int, decimal, datetime,
    index, uniqueIndex, mysqlEnum
} from "drizzle-orm/mysql-core";

/* ============================
   categories
============================ */
export const categories = mysqlTable(
    "categories",
    {
        id: int("id", { unsigned: true }).autoincrement().primaryKey(),
        name: varchar("name", { length: 255 }).notNull(),
    },
    (t) => ({
        uidxName: uniqueIndex("uidx_categories_name").on(t.name),
    })
);

/* ============================
   suppliers
============================ */
export const suppliers = mysqlTable(
    "suppliers",
    {
        id: int("id", { unsigned: true }).autoincrement().primaryKey(),
        company_name: varchar("company_name", { length: 255 }).notNull(),
        email: varchar("email", { length: 255 }),
        tel: varchar("tel", { length: 50 }),
    },
    (t) => ({
        idxCompany: index("idx_suppliers_company").on(t.company_name),
    })
);

/* ============================
   products  (UUID + generated profit + datetime + product_status)
============================ */
export const products = mysqlTable(
    "products",
    {
        id: varchar("id", { length: 36 })
            .$defaultFn(() => crypto.randomUUID())
            .primaryKey(),

        image: varchar("image", { length: 255 }),
        name: varchar("name", { length: 255 }).notNull(),
        description: text("description"),

        category_id: int("category_id", { unsigned: true }).references(() => categories.id, {
            onDelete: "set null",
            onUpdate: "cascade",
        }),

        unit: varchar("unit", { length: 255 }),

        // ราคาหลัก
        cost: decimal("cost", { precision: 10, scale: 2 }).notNull().default("0.00"),
        sell: decimal("sell", { precision: 10, scale: 2 }).notNull().default("0.00"),

        // กำไรแบบ generated (stored)
        // หมายเหตุ: ใช้ .stored() เพื่อให้เข้ากับ API ของ Drizzle
        profit: decimal("profit", { precision: 10, scale: 2 })
            .generatedAlwaysAs(sql`(sell - cost)`, { mode: "stored" }),

        // จำนวนตามระบบ (book)
        quantity: int("quantity", { unsigned: true }).notNull().default(0),

        // จำนวนที่ “นับจริง” ล่าสุด (physical)
        counted_qty: int("counted_qty", { unsigned: true }).notNull().default(0),

        // เวลาและโน้ตการนับล่าสุด
        last_counted_at: datetime("last_counted_at"),
        count_note: text("count_note"),

        // จำนวนที่สั่งไว้แต่ยังไม่เข้า
        quantity_pending: int("quantity_pending", { unsigned: true }).notNull().default(0),

        supplier_id: int("supplier_id", { unsigned: true }).references(
            () => suppliers.id,
            { onDelete: "set null", onUpdate: "cascade" }
        ),

        product_status: mysqlEnum("product_status", [
            "active", "low_stock", "restock_pending", "pricing_pending",
        ]).notNull().default("active"),

        created_at: datetime("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
        updated_at: datetime("updated_at").$onUpdateFn(() => new Date()),
    },
    (t) => ({
        idxCategory: index("idx_products_category").on(t.category_id),
        idxProductsName: index("idx_products_name").on(t.name),
        idxProductsCountedAt: index("idx_products_counted_at").on(t.last_counted_at),
    })
);

/* ============================
   stock_in_batches (หัวบิลสั่งเข้า)
============================ */
export const stock_in_batches = mysqlTable(
    "stock_in_batches",
    {
        id: int("id", { unsigned: true }).autoincrement().primaryKey(),

        supplier_id: int("supplier_id", { unsigned: true })
            .references(() => suppliers.id, {
                onDelete: "set null",
                onUpdate: "cascade",
            }),

        expected_date: datetime("expected_date"),

        batch_status: mysqlEnum("batch_status", [
            "pending", "some_received", "completed", "canceled"
        ]).notNull().default("pending"),

        note: text("note"),

        created_at: datetime("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
        updated_at: datetime("updated_at").$onUpdateFn(() => new Date()),
    },
    (t) => ({
        idxBatchSupplier: index("idx_stockin_batches_supplier").on(t.supplier_id),
        idxBatchStatus: index("idx_stockin_batches_status").on(t.batch_status),
    })
);

/* ============================
   stock_in (รายละเอียดในบิล / รองรับ partial receive)
   - quantity      = จำนวนที่สั่ง (ordered)
   - received_qty  = จำนวนที่รับแล้ว (สะสม)
   - unit_cost     = ราคาทุนที่ผู้สั่งซื้อกรอก
============================ */
export const stock_in = mysqlTable(
    "stock_in",
    {
        id: int("id", { unsigned: true }).autoincrement().primaryKey(),

        batch_id: int("batch_id", { unsigned: true })
            .notNull()
            .references(() => stock_in_batches.id, {
                onDelete: "cascade",
                onUpdate: "cascade",
            }),

        product_id: varchar("product_id", { length: 36 })
            .notNull()
            .references(() => products.id, {
                onDelete: "restrict",
                onUpdate: "cascade",
            }),

        quantity: int("quantity", { unsigned: true }).notNull().default(0),       // ordered_qty
        received_qty: int("received_qty", { unsigned: true }).notNull().default(0),

        unit_cost: decimal("unit_cost", { precision: 10, scale: 2 }).notNull().default("0.00"),

        received_date: datetime("received_date"),

        supplier_id: int("supplier_id", { unsigned: true })
            .references(() => suppliers.id, {
                onDelete: "set null",
                onUpdate: "cascade",
            }),

        stock_in_status: mysqlEnum("stock_in_status", [
            "pending", "some_received", "completed", "canceled"
        ]).notNull().default("pending"),

        note: text("note"),
    },
    (t) => ({
        idxStockInBatch: index("idx_stockin_batch").on(t.batch_id),
        idxStockInProduct: index("idx_stockin_product").on(t.product_id),
        idxStockInSupplier: index("idx_stockin_supplier").on(t.supplier_id),
    })
);

/* ============================
   customers
============================ */
export const customers = mysqlTable(
    "customers",
    {
        id: int("id", { unsigned: true }).autoincrement().primaryKey(),
        fname: varchar("fname", { length: 100 }),
        lname: varchar("lname", { length: 100 }),
        email: varchar("email", { length: 255 }),
        tel: varchar("tel", { length: 50 }),
    },
    (t) => ({
        idxCustomerEmail: index("idx_customers_email").on(t.email),
        idxCustomerTel: index("idx_customers_tel").on(t.tel),
    })
);

/* ============================
   employee
============================ */
export const employee = mysqlTable(
    "employee",
    {
        id: int("id", { unsigned: true }).autoincrement().primaryKey(),
        fname: varchar("fname", { length: 100 }),
        lname: varchar("lname", { length: 100 }),
        username: varchar("username", { length: 100 }).notNull(),
        employee_status: mysqlEnum("employee_status", ["active", "inactive"]).notNull().default("active"),
        tel: varchar("tel", { length: 50 }),
        role: mysqlEnum("role", ["owner", "warehouse", "sale"]).default("sale"),
        email: varchar("email", { length: 255 }).notNull(),
        password: varchar("password", { length: 255 }).notNull(),
        created_at: datetime("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
        updated_at: datetime("updated_at").$onUpdateFn(() => new Date()),
    },
    (t) => ({
        uidxEmployeeEmail: uniqueIndex("uidx_employee_email").on(t.email),
        uidxEmployeeUsername: uniqueIndex("uidx_employee_username").on(t.username),
    })
);

/* ============================
   orders
============================ */
export const orders = mysqlTable(
    "orders",
    {
        id: int("id", { unsigned: true }).autoincrement().primaryKey(),

        sale_id: int("sale_id", { unsigned: true }).references(() => employee.id, {
            onDelete: "set null",
            onUpdate: "cascade",
        }),

        order_number: varchar("order_number", { length: 100 }).notNull(),

        customer_id: int("customer_id", { unsigned: true })
            .notNull()
            .references(() => customers.id, { onDelete: "restrict", onUpdate: "cascade" }),

        order_date: datetime("order_date").default(sql`CURRENT_TIMESTAMP`),

        total_amount: decimal("total_amount", { precision: 12, scale: 2 }).notNull().default("0.00"),

        order_status: mysqlEnum("order_status", ["completed", "canceled"])
            .notNull().default("completed"),

        note: text("note"),
        bill: varchar("bill", { length: 255 }),

        created_at: datetime("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
        updated_at: datetime("updated_at").$onUpdateFn(() => new Date()),
    },
    (t) => ({
        uidxOrderNumber: uniqueIndex("uidx_orders_order_number").on(t.order_number),
        idxOrdersCustomer: index("idx_orders_customer").on(t.customer_id),
        idxOrdersSale: index("idx_orders_sale").on(t.sale_id),
    })
);

/* ============================
   order_items (FK -> products.id เป็น varchar(36))
============================ */
export const order_items = mysqlTable(
    "order_items",
    {
        id: int("id", { unsigned: true }).autoincrement().primaryKey(),

        order_id: int("order_id", { unsigned: true })
            .notNull()
            .references(() => orders.id, { onDelete: "cascade", onUpdate: "cascade" }),

        product_id: varchar("product_id", { length: 36 })
            .notNull()
            .references(() => products.id, { onDelete: "restrict", onUpdate: "cascade" }),

        quantity: int("quantity", { unsigned: true }).notNull().default(1),
        unit_price: decimal("unit_price", { precision: 12, scale: 2 }).notNull().default("0.00"),
        total_price: decimal("total_price", { precision: 12, scale: 2 }).notNull().default("0.00"),
    },
    (t) => ({
        uidxOrderProduct: uniqueIndex("uidx_order_items_order_product").on(t.order_id, t.product_id),
        idxOrderItemsProduct: index("idx_order_items_product").on(t.product_id),
    })
);
