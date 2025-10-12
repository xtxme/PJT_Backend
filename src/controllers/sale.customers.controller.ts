import { Router, Request, Response, NextFunction } from "express";
import { dbClient } from "@db/client.js";
import { customers, orders } from "@db/schema.js";
import { eq, sql } from "drizzle-orm";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

// 🟩 GET: ดึงลูกค้าพร้อมยอดรวม
router.get(
    "/",
    asyncHandler(async (_req: Request, res: Response, next: NextFunction) => {
        const result = await dbClient
            .select({
                id: customers.id,
                name: sql`CONCAT(${customers.fname}, ' ', ${customers.lname})`,
                address: sql`MIN(${customers.address})`,
                email: sql`MIN(${customers.email})`,
                tel: sql`MIN(${customers.tel})`,
                totalPaid: sql`COALESCE(SUM(${orders.total_amount}), 0)`,
            })
            .from(customers)
            .leftJoin(orders, eq(customers.id, orders.customer_id))
            .groupBy(customers.id);


        res.json({ success: true, data: result });
    })
);

// 🟦 POST: เพิ่มลูกค้าใหม่
router.post(
    "/",
    asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        const { name, address, totalPaid } = req.body;
        if (!name || !address) {
            res.status(400).json({ success: false, message: "กรุณากรอกชื่อและที่อยู่" });
            return;
        }

        const [fname, lname = ""] = name.split(" ");
        const inserted = await dbClient
            .insert(customers)
            .values({ fname, lname, address })
            .$returningId();

        const newCustomerId = inserted[0].id;

        if (Number(totalPaid) > 0) {
            await dbClient.insert(orders).values({
                customer_id: newCustomerId,
                order_number: `INIT-${Date.now()}`,
                total_amount: totalPaid,
                status: "completed",
            });
        }

        const [newCustomer] = await dbClient
            .select({
                id: customers.id,
                name: sql`CONCAT(${customers.fname}, ' ', ${customers.lname})`,
                address: customers.address,
                totalPaid: sql`${totalPaid || 0}`,
            })
            .from(customers)
            .where(eq(customers.id, newCustomerId));

        res.json({ success: true, data: newCustomer });
    })
);

export default router;
