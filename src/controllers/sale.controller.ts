import { Router } from "express";
import { makeCrudRouter } from "./crud.controller.js";
import { dbClient } from "@db/client.js";
import { orders, employee } from "@db/schema.js";
import saleCustomerRouter from "./sale.customers.controller.js";

const router = Router();

// CRUD สำหรับ orders
const query = {
    findMany: async () => await dbClient.select().from(orders).orderBy(orders.created_at),
};
const saleRouter = makeCrudRouter(query, orders);
router.use("/", saleRouter);

// 🔹 เชื่อม customers router ที่แยกไฟล์ไว้
router.use("/customers", saleCustomerRouter);

// รายชื่อพนักงาน
router.get("/employees", async (_req, res, next) => {
    try {
        const employees = await dbClient
            .select({
                id: employee.id,
                name: employee.fname,
            })
            .from(employee);

        res.json(employees);
    } catch (e) {
        next(e);
    }
});

export default router;
