import { Router } from "express";
import { dbClient } from "@db/client.js";
import {
    categories, suppliers, products, customers,
    employee, orders, order_items, log, stock_in
} from "@db/schema.js";
import { makeCrudRouter } from "../controllers/crud.controller.js";

const router = Router();

// สร้างชุด CRUD ต่อ table
router.use("/categories",   makeCrudRouter(dbClient.query.categories, categories));
router.use("/suppliers",    makeCrudRouter(dbClient.query.suppliers, suppliers));
router.use("/products",     makeCrudRouter(dbClient.query.products, products));
router.use("/customers",    makeCrudRouter(dbClient.query.customers, customers));
router.use("/employee",     makeCrudRouter(dbClient.query.employee, employee));
router.use("/orders",       makeCrudRouter(dbClient.query.orders, orders));
router.use("/order_items",  makeCrudRouter(dbClient.query.order_items, order_items));
router.use("/log",          makeCrudRouter(dbClient.query.log, log));
router.use("/stock_in",     makeCrudRouter(dbClient.query.stock_in, stock_in));

export default router;
