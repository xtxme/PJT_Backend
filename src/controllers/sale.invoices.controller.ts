import { Router, Request, Response, NextFunction } from "express";
import { dbClient } from "@db/client.js";
import { orders, customers, employee, order_items, products } from "@db/schema.js";
import { eq, sql, desc } from "drizzle-orm";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

/* 🟩 GET — ดึงบิลทั้งหมด พร้อมข้อมูลลูกค้าและพนักงานขาย */
router.get(
    "/",
    asyncHandler(async (_req: Request, res: Response) => {
        const invoices = await dbClient
            .select({
                id: orders.id,
                order_number: orders.order_number,
                customer_name: sql`CONCAT(${customers.fname}, ' ', ${customers.lname})`.as("customer_name"),
                sale_name: sql`COALESCE(CONCAT(${employee.fname}, ' ', ${employee.lname}), '-')`.as("sale_name"),
                order_date: orders.order_date,
                total_amount: orders.total_amount,
                bill: orders.bill,
                status: orders.status,
                note: orders.note,
            })
            .from(orders)
            .leftJoin(customers, eq(orders.customer_id, customers.id))
            .leftJoin(employee, eq(orders.sale_id, employee.id))
            .orderBy(desc(orders.order_date));

        res.json({ success: true, data: invoices });
    })
);

/* 🟦 GET — ดึงรายละเอียดบิล (รวมสินค้าในบิลด้วย) */
router.get(
    "/:id",
    asyncHandler(async (req: Request, res: Response) => {
        const id = Number(req.params.id);

        // ดึงข้อมูลบิลหลัก
        const [invoice] = await dbClient
            .select({
                id: orders.id,
                order_number: orders.order_number,
                order_date: orders.order_date,
                total_amount: orders.total_amount,
                status: orders.status,
                note: orders.note,
                bill: orders.bill,
                customer_name: sql`CONCAT(${customers.fname}, ' ', ${customers.lname})`.as("customer_name"),
                sale_name: sql`COALESCE(CONCAT(${employee.fname}, ' ', ${employee.lname}), '-')`.as("sale_name"),
            })
            .from(orders)
            .leftJoin(customers, eq(orders.customer_id, customers.id))
            .leftJoin(employee, eq(orders.sale_id, employee.id))
            .where(eq(orders.id, id));

        if (!invoice) {
            res.status(404).json({ success: false, message: "ไม่พบบิลนี้" });
        }

        // ดึงรายการสินค้าภายในบิล
        const items = await dbClient
            .select({
                id: order_items.id,
                product_id: order_items.product_id,
                product_name: products.name,
                quantity: order_items.quantity,
                unit_price: order_items.unit_price,
                total_price: order_items.total_price,
            })
            .from(order_items)
            .leftJoin(products, eq(order_items.product_id, products.id))
            .where(eq(order_items.order_id, id));

        res.json({
            success: true,
            data: { ...invoice, items },
        });
    })
);


/* 🟦 POST — เพิ่มบิลใหม่ */
router.post(
    "/",
    asyncHandler(async (req: Request, res: Response) => {
        const { order_number, customer_id, sale_id, total_amount, bill, note } = req.body;

        if (!order_number || !customer_id) {
            res.status(400).json({
                success: false,
                message: "กรุณาระบุหมายเลขบิลและลูกค้า",
            });
        }

        // ✅ เพิ่มวันที่ order_date = NOW()
        const [inserted] = await dbClient
            .insert(orders)
            .values({
                order_number,
                customer_id,
                sale_id: sale_id || null,
                total_amount: total_amount ?? "0",
                bill: bill || null,
                note: note || null,
                status: "completed",
                order_date: sql`NOW()`,
            })
            .$returningId();

        const newInvoiceId = inserted.id;

        const [newInvoice] = await dbClient
            .select({
                id: orders.id,
                order_number: orders.order_number,
                customer_name: sql`CONCAT(${customers.fname}, ' ', ${customers.lname})`.as("customer_name"),
                sale_name: sql`COALESCE(CONCAT(${employee.fname}, ' ', ${employee.lname}), '-')`.as("sale_name"),
                order_date: orders.order_date,
                total_amount: orders.total_amount,
                bill: orders.bill,
                status: orders.status,
                note: orders.note,
            })
            .from(orders)
            .leftJoin(customers, eq(orders.customer_id, customers.id))
            .leftJoin(employee, eq(orders.sale_id, employee.id))
            .where(eq(orders.id, newInvoiceId));

        res.json({ success: true, data: newInvoice });
    })
);

/* 🟧 PUT — ยกเลิกบิล */
router.put(
    "/:id/cancel",
    asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        try {
            const id = Number(req.params.id);

            // 🧾 1) ดึงข้อมูลบิลและรายการสินค้า
            const [invoice] = await dbClient
                .select({
                    id: orders.id,
                    total_amount: orders.total_amount,
                    customer_id: orders.customer_id,
                })
                .from(orders)
                .where(eq(orders.id, id));

            if (!invoice) {
                res.status(404).json({ success: false, message: "ไม่พบบิลนี้" });
            }

            // ❗ 2) ตรวจว่าบิลนี้ถูกยกเลิกไปแล้วหรือยัง
            const [currentStatus] = await dbClient
                .select({ status: orders.status })
                .from(orders)
                .where(eq(orders.id, id));

            if (currentStatus?.status === "canceled") {
                res.json({ success: false, message: "บิลนี้ถูกยกเลิกแล้ว" });
            }

            // 🧮 3) ดึงรายการสินค้าในบิล
            const orderItems = await dbClient
                .select({
                    product_id: order_items.product_id,
                    quantity: order_items.quantity,
                })
                .from(order_items)
                .where(eq(order_items.order_id, id));

            // 🛠️ 4) อัปเดตจำนวนสินค้าให้กลับเข้าสต็อก
            for (const item of orderItems) {
                await dbClient
                    .update(products)
                    .set({
                        quantity: sql`${products.quantity} + ${item.quantity}`,
                    })
                    .where(eq(products.id, item.product_id));
            }

            // 🧾 5) เปลี่ยนสถานะบิลเป็น canceled
            await dbClient
                .update(orders)
                .set({ status: "canceled" })
                .where(eq(orders.id, id));

            // 💳 6) อัปเดตยอดรวมลูกค้า (recalculate)
            const [newTotal] = await dbClient
                .select({
                    total: sql`COALESCE(SUM(${orders.total_amount}), 0)`,
                })
                .from(orders)
                .where(
                    sql`${orders.customer_id} = ${invoice.customer_id} AND ${orders.status} = 'completed'`
                );

            // (กรณีคุณมีฟิลด์ totalPaid ใน customers)
            // await dbClient.update(customers).set({ totalPaid: newTotal.total }).where(eq(customers.id, invoice.customer_id));

            // 📦 7) ดึงข้อมูลล่าสุดเพื่อตอบกลับ frontend
            const [updated] = await dbClient
                .select({
                    id: orders.id,
                    order_number: orders.order_number,
                    status: orders.status,
                    total_amount: orders.total_amount,
                    order_date: orders.order_date,
                })
                .from(orders)
                .where(eq(orders.id, id));

            res.json({
                success: true,
                message: `✅ ยกเลิกบิลเลขที่ ${updated.id} เรียบร้อย`,
                data: updated,
            });
        } catch (err) {
            console.error("❌ ยกเลิกบิลล้มเหลว:", err);
            next(err);
        }
    })
);


/* 💰 GET — สรุปยอดรวมเฉพาะ completed */
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
