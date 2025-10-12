import { Router, Request, Response, NextFunction } from "express";
import { dbClient } from "@db/client.js";
import { orders, customers, employee } from "@db/schema.js";
import { eq, sql, desc } from "drizzle-orm";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

/* 🟩 GET — ดึงบิลทั้งหมด พร้อมข้อมูลลูกค้าและพนักงานขาย */
router.get(
    "/",
    asyncHandler(async (_req: Request, res: Response, _next: NextFunction) => {
        const result = await dbClient
            .select({
                id: orders.id,
                order_number: orders.order_number,
                customer_name: sql`CONCAT(${customers.fname}, ' ', ${customers.lname})`.as("customer_name"),
                sale_name: sql`CONCAT(${employee.fname}, ' ', ${employee.lname})`.as("sale_name"),
                order_date: orders.order_date,
                total_amount: orders.total_amount,
                bill: orders.bill,
                status: orders.status,
            })
            .from(orders)
            .leftJoin(customers, eq(orders.customer_id, customers.id))
            .leftJoin(employee, eq(orders.sale_id, employee.id))
            .orderBy(desc(orders.order_date));

        res.json({ success: true, data: result });
    })
);

/* 🟦 POST — เพิ่มบิลใหม่ */
router.post(
    "/",
    asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
        const { order_number, customer_id, sale_id, total_amount, bill, note } = req.body;

        if (!order_number || !customer_id) {
            res.status(400).json({
                success: false,
                message: "กรุณาระบุหมายเลขบิลและลูกค้า",
            });
            return; // ออกจากฟังก์ชันเองโดยไม่ return res
        }

        const inserted = await dbClient
            .insert(orders)
            .values({
                order_number,
                customer_id,
                sale_id,
                total_amount,
                bill,
                note,
                status: "completed",
            })
            .$returningId();

        const newInvoiceId = inserted[0].id;

        const [newInvoice] = await dbClient
            .select({
                id: orders.id,
                order_number: orders.order_number,
                customer_name: sql`CONCAT(${customers.fname}, ' ', ${customers.lname})`.as("customer_name"),
                sale_name: sql`CONCAT(${employee.fname}, ' ', ${employee.lname})`.as("sale_name"),
                order_date: orders.order_date,
                total_amount: orders.total_amount,
                bill: orders.bill,
                status: orders.status,
            })
            .from(orders)
            .leftJoin(customers, eq(orders.customer_id, customers.id))
            .leftJoin(employee, eq(orders.sale_id, employee.id))
            .where(eq(orders.id, newInvoiceId));

        res.json({ success: true, data: newInvoice });
    })
);

/* 🟧 PUT — ยกเลิกบิล (เปลี่ยนสถานะเป็น canceled) */
router.put(
    "/:id/cancel",
    asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        try {
            const id = Number(req.params.id);

            await dbClient
                .update(orders)
                .set({ status: "canceled" })
                .where(eq(orders.id, id));

            const [updated] = await dbClient
                .select({
                    id: orders.id,
                    order_number: orders.order_number,
                    customer_name: sql`CONCAT(${customers.fname}, ' ', ${customers.lname})`.as("customer_name"),
                    sale_name: sql`CONCAT(${employee.fname}, ' ', ${employee.lname})`.as("sale_name"),
                    total_amount: orders.total_amount,
                    bill: orders.bill,
                    status: orders.status,
                })
                .from(orders)
                .leftJoin(customers, eq(orders.customer_id, customers.id))
                .leftJoin(employee, eq(orders.sale_id, employee.id))
                .where(eq(orders.id, id));

            res.json({
                success: true,
                message: `ยกเลิกบิลหมายเลข ${id} สำเร็จแล้ว ✅`,
                data: updated,
            });
        } catch (err) {
            console.error("❌ ยกเลิกบิลล้มเหลว:", err);
            next(err);
        }
    })
);

/* 💰 GET — สรุปยอดรวมบิลทั้งหมด (เฉพาะ completed) */
router.get(
    "/summary/all",
    asyncHandler(async (_req: Request, res: Response) => {
        const [summary] = await dbClient
            .select({
                totalSales: sql`COALESCE(SUM(${orders.total_amount}), 0)`.as("totalSales"),
            })
            .from(orders)
            .where(eq(orders.status, "completed"));

        res.json({ success: true, data: summary });
    })
);

export default router;
