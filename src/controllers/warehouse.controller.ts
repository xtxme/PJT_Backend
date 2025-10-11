import { Router } from "express";
import { makeCrudRouter } from "./crud.controller.js";
import { dbClient } from "@db/client.js";
import { orders, employee } from "@db/schema.js";

const router = Router();

// 💼 --- ROUTE CRUD สำหรับ SALES (orders) ---
const query = {
    findMany: async () => await dbClient.select().from(orders).orderBy(orders.created_at),
};
const saleRouter = makeCrudRouter(query, orders);

// นำ route CRUD ทั้งหมดของ orders มาใช้ภายใต้ /sales
router.use("/", saleRouter);

// 👤 --- ROUTE ดึงรายชื่อพนักงาน (เฉพาะชื่อเท่านั้น) ---
router.get("/employees", async (_req, res, next) => {
    try {
        // ดึงเฉพาะ id, fname, lname
        const employees = await dbClient
            .select({
                id: employee.id,
                name: employee.fname, // หรือจะ concat fname + lname ก็ได้
            })
            .from(employee);

        res.json(employees);
    } catch (e) {
        next(e);
    }
});

export default router;
