import { mysqlTable, varchar, text, int, decimal, timestamp, index, uniqueIndex, mysqlEnum } from "drizzle-orm/mysql-core";
import { sql } from "drizzle-orm";

// categories
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

// suppliers
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

// products
export const products = mysqlTable(
  "products",
  {
    id: int("id", { unsigned: true }).autoincrement().primaryKey(),
    image: varchar("image", { length: 255 }),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    category_id: int("category_id", { unsigned: true }).references(() => categories.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    unit: int("unit", { unsigned: true }),
    cost: decimal("cost", { precision: 10, scale: 2 }),
    sell: decimal("sell", { precision: 10, scale: 2 }),
    profit: decimal("profit", { precision: 10, scale: 2 }),
    quantity: int("quantity", { unsigned: true }).notNull().default(0),
    quantity_pending: int("quantity_pending", { unsigned: true }).notNull().default(0),
    company: varchar("company", { length: 255 }),
    status: mysqlEnum("status", ["active", "low_stock", "restock_pending", "pricing_pending"])
      .notNull().default("active"),
    created_at: timestamp("created_at").defaultNow().notNull(),
    updated_at: timestamp("updated_at").onUpdateNow(),
  },
  (t) => ({
    idxCategory: index("idx_products_category").on(t.category_id),
    uidxProductName: index("idx_products_name").on(t.name), // ถ้าต้องการ unique ให้เปลี่ยนเป็น uniqueIndex
  })
);

// stock_in
export const stock_in = mysqlTable(
  "stock_in",
  {
    id: int("id", { unsigned: true }).autoincrement().primaryKey(),
    product_id: int("product_id", { unsigned: true }).notNull().references(() => products.id, {
      onDelete: "restrict", // ไม่ให้ลบสินค้าที่มีประวัติรับเข้า
      onUpdate: "cascade",
    }),
    quantity: int("quantity", { unsigned: true }).notNull().default(0),
    received_date: timestamp("received_date").defaultNow(),
    supplier_id: int("supplier_id", { unsigned: true }).references(() => suppliers.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    status: mysqlEnum("status", ["pending", "some_received", "completed", "canceled"]).notNull().default("pending"),
    note: text("note"),
  },
  (t) => ({
    idxStockInProduct: index("idx_stockin_product").on(t.product_id),
    idxStockInSupplier: index("idx_stockin_supplier").on(t.supplier_id),
  })
);

// customers
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

// employee
export const employee = mysqlTable(
  "employee",
  {
    id: int("id", { unsigned: true }).autoincrement().primaryKey(),
    fname: varchar("fname", { length: 100 }),
    lname: varchar("lname", { length: 100 }),
    username: varchar("username", { length: 100 }),
    status: mysqlEnum("status", ["active", "inactive"]).notNull().default("active"),
    tel: varchar("tel", { length: 50 }),
    role: mysqlEnum("role", ["owner", "warehouse_staff", "sales"]).default("sales"),
    email: varchar("email", { length: 255 }),
    password: varchar("password", { length: 255 }).notNull(),
    created_at: timestamp("created_at").defaultNow().notNull(),
    updated_at: timestamp("updated_at").onUpdateNow(),
  },
  (t) => ({
    uidxEmployeeEmail: uniqueIndex("uidx_employee_email").on(t.email),
    uidxEmployeeUsername: uniqueIndex("uidx_employee_username").on(t.username),
  })
);

// orders
export const orders = mysqlTable(
  "orders",
  {
    id: int("id", { unsigned: true }).autoincrement().primaryKey(),
    sale_id: int("sale_id", { unsigned: true }).references(() => employee.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    order_number: varchar("order_number", { length: 100 }).notNull(),
    customer_id: int("customer_id", { unsigned: true }).notNull().references(() => customers.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    order_date: timestamp("order_date").defaultNow(),
    total_amount: decimal("total_amount", { precision: 12, scale: 2 }).notNull().default("0.00"),
    status: mysqlEnum("status", ["completed", "canceled"]).notNull().default("completed"),
    note: text("note"),
    bill: varchar("bill", { length: 255 }),
    created_at: timestamp("created_at").defaultNow().notNull(),
    updated_at: timestamp("updated_at").onUpdateNow(),
  },
  (t) => ({
    uidxOrderNumber: uniqueIndex("uidx_orders_order_number").on(t.order_number),
    idxOrdersCustomer: index("idx_orders_customer").on(t.customer_id),
    idxOrdersSale: index("idx_orders_sale").on(t.sale_id),
  })
);

// order_items
export const order_items = mysqlTable(
  "order_items",
  {
    id: int("id", { unsigned: true }).autoincrement().primaryKey(),
    order_id: int("order_id", { unsigned: true }).notNull().references(() => orders.id, {
      onDelete: "cascade", // ลบออเดอร์แล้วรายการย่อยต้องหายตาม
      onUpdate: "cascade",
    }),
    product_id: int("product_id", { unsigned: true }).notNull().references(() => products.id, {
      onDelete: "restrict", // ไม่ให้ลบสินค้าที่ถูกขายไปแล้ว
      onUpdate: "cascade",
    }),
    quantity: int("quantity", { unsigned: true }).notNull().default(1),
    unit_price: decimal("unit_price", { precision: 12, scale: 2 }).notNull().default("0.00"),
    total_price: decimal("total_price", { precision: 12, scale: 2 }).notNull().default("0.00"),
  },
  (t) => ({
    uidxOrderProduct: uniqueIndex("uidx_order_items_order_product").on(t.order_id, t.product_id),
    idxOrderItemsProduct: index("idx_order_items_product").on(t.product_id),
  })
);