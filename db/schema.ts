import { mysqlTable, varchar, text, int, float, decimal, timestamp, char } from "drizzle-orm/mysql-core";

// categories
export const categories = mysqlTable("categories", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
});

// suppliers
export const suppliers = mysqlTable("suppliers", {
  id: int("id").autoincrement().primaryKey(),
  company_name: varchar("company_name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }),
  tel: varchar("tel", { length: 50 }),
});

// products
export const products = mysqlTable("products", {
  id: int("id").autoincrement().primaryKey(),
  image: varchar("image", { length: 255 }),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  category_id: int("category_id"),
  unit: int("unit"),
  cost: float("cost"),
  sell: float("sell"),
  profit: float("profit"),
  quantity: int("quantity"),
  quantity_pending: int("quantity_pending"),
  company: varchar("company", { length: 255 }),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").onUpdateNow(),
});

// stock_in
export const stock_in = mysqlTable("stock_in", {
  id: int("id").autoincrement().primaryKey(),
  product_id: int("product_id").notNull(),
  quantity: int("quantity"),
  received_date: timestamp("received_date"),
  supplier_id: int("supplier_id"),
  status: varchar("status", { length: 50 }),
  note: text("note"),
});

// customers
export const customers = mysqlTable("customers", {
  id: int("id").autoincrement().primaryKey(),
  fname: varchar("fname", { length: 100 }),
  lname: varchar("lname", { length: 100 }),
  email: varchar("email", { length: 255 }),
  tel: varchar("tel", { length: 50 }),
});

// employee
export const employee = mysqlTable("employee", {
  id: int("id").autoincrement().primaryKey(),
  fname: varchar("fname", { length: 100 }),
  lname: varchar("lname", { length: 100 }),
  username: varchar("username", { length: 100 }),
  status: varchar("status", { length: 50 }),
  tel: varchar("tel", { length: 50 }),
  role: varchar("role", { length: 50 }),
  email: varchar("email", { length: 255 }),
  password: varchar("password", { length: 255 }).notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").onUpdateNow(),
});

// orders
export const orders = mysqlTable("orders", {
  id: int("id").autoincrement().primaryKey(),
  sale_id: int("sale_id").references(() => employee.id),
  order_number: varchar("order_number", { length: 100 }),
  customer_id: int("customer_id").notNull(),
  order_date: timestamp("order_date").defaultNow(),
  total_amount: decimal("total_amount", { precision: 10, scale: 2 }),
  status: varchar("status", { length: 50 }),
  note: text("note"),
  bill: varchar("bill", { length: 255 }),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").onUpdateNow(),
});

// order_items
export const order_items = mysqlTable("order_items", {
  id: int("id").autoincrement().primaryKey(),
  order_id: int("order_id").notNull().references(() => orders.id),
  product_id: int("product_id").notNull(),
  quantity: int("quantity"),
  unit_price: decimal("unit_price", { precision: 10, scale: 2 }),
  total_price: decimal("total_price", { precision: 10, scale: 2 }),
});

// log
export const log = mysqlTable("log", {
  id: int("id").autoincrement().primaryKey(),
  employee_id: int("employee_id").notNull(),
  action_name: varchar("action_name", { length: 100 }),
  detail: text("detail"),
  created_at: timestamp("created_at").defaultNow().notNull(),
});
