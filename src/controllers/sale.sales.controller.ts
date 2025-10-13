import { Router, Request, Response } from "express";
import { dbClient } from "@db/client.js";
import { customers, products, orders, order_items } from "@db/schema.js";
import { eq, sql, desc, like } from "drizzle-orm";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

/* 🟩 GET /sales/customers — ดึงรายชื่อลูกค้าทั้งหมด */
router.get(
    "/customers",
    asyncHandler(async (_req: Request, res: Response) => {
        const result = await dbClient
            .select({
                id: customers.id,
                name: sql`CONCAT(${customers.fname}, ' ', ${customers.lname})`.as("name"),
                address: customers.address,
                email: customers.email,
                tel: customers.tel,
            })
            .from(customers)
            .orderBy(customers.id);

        res.json({ success: true, data: result });
    })
);

/* 🟦 GET /sales/products — ดึงสินค้าทั้งหมดที่ active */
router.get(
    "/products",
    asyncHandler(async (_req: Request, res: Response) => {
        const result = await dbClient
            .select({
                id: products.id,
                name: products.name,
                sell: products.sell,
                quantity: products.quantity,
                status: products.product_status, // 👈 ปรับชื่อ field
            })
            .from(products)
            // .where(eq(products.product_status, "active"))
            .orderBy(products.id);

        res.json({ success: true, data: result });
    })
);

/* 🧾 GET /sales/new-invoice — สร้างเลขที่บิลใหม่ */
router.get(
    "/new-invoice",
    asyncHandler(async (_req: Request, res: Response) => {
        try {
            const now = new Date();
            const thaiYear = now.getFullYear() + 543; // แปลงเป็น พ.ศ.
            const prefixDate = `${String(thaiYear).slice(-2)}${String(
                now.getMonth() + 1
            ).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
            const prefix = `INV-${prefixDate}`;

            const [latestOrder] = await dbClient
                .select({ order_number: orders.order_number })
                .from(orders)
                .where(like(orders.order_number, `${prefix}%`))
                .orderBy(desc(orders.order_number))
                .limit(1);

            let runningNumber = "0001";
            if (latestOrder?.order_number) {
                const lastRun = Number(latestOrder.order_number.slice(-4));
                runningNumber = String(lastRun + 1).padStart(4, "0");
            }

            const newInvoice = `${prefix}${runningNumber}`;
            res.json({ success: true, invoiceNo: newInvoice });
        } catch (err) {
            console.error("❌ Error generating invoice number:", err);
            res.status(500).json({ success: false, message: "สร้างเลขบิลไม่สำเร็จ" });
        }
    })
);

/* 🟨 GET /sales/latest — ดึง order ล่าสุด 10 รายการ */
router.get(
    "/latest",
    asyncHandler(async (_req: Request, res: Response) => {
        const result = await dbClient
            .select({
                id: orders.id,
                order_number: orders.order_number,
                total_amount: orders.total_amount,
                created_at: orders.created_at,
            })
            .from(orders)
            .orderBy(desc(orders.created_at))
            .limit(10);

        res.json({ success: true, data: result });
    })
);

/* 🟥 POST /sales — สร้างออเดอร์ใหม่ และอัปเดตสถานะสินค้า */
router.post(
    "/",
    asyncHandler(async (req: Request, res: Response) => {
        try {
            const { customerId, invoiceNo, totalAmount, productsInBill, saleId } = req.body;

            if (!customerId || !productsInBill?.length) {
                res.status(400).json({
                    success: false,
                    message: "กรุณาเลือกลูกค้าและเพิ่มสินค้าอย่างน้อย 1 รายการ",
                });
            }

            // ✅ insert order
            const [newOrder] = await dbClient
                .insert(orders)
                .values({
                    order_number: invoiceNo,
                    customer_id: Number(customerId),
                    sale_id: Number(saleId),
                    total_amount: String(totalAmount ?? 0),
                    order_status: "completed", // 👈 ใช้ชื่อใหม่
                })
                .$returningId();

            const orderId = newOrder.id;

            // ✅ วนทุกสินค้าในบิล
            for (const item of productsInBill) {
                const qty = Number(item.qty);
                const sell = Number(item.sell);

                // ✅ บันทึกรายการย่อย
                await dbClient.insert(order_items).values({
                    order_id: orderId,
                    product_id: String(item.id), // 👈 UUID เป็น string
                    quantity: qty,
                    unit_price: String(sell),
                    total_price: String(qty * sell),
                });

                // ✅ หักสต็อก
                await dbClient
                    .update(products)
                    .set({ quantity: sql`${products.quantity} - ${qty}` })
                    .where(eq(products.id, String(item.id)));

                // ✅ ดึงจำนวนปัจจุบันหลังหัก
                const [updated] = await dbClient
                    .select({ quantity: products.quantity })
                    .from(products)
                    .where(eq(products.id, String(item.id)));

                const remaining = updated?.quantity ?? 0;

                // ✅ คำนวณสถานะใหม่
                let newStatus:
                    | "active"
                    | "low_stock"
                    | "restock_pending"
                    | "pricing_pending" = "active";
                if (remaining === 0) newStatus = "low_stock";
                else if (remaining <= 10) newStatus = "low_stock";

                // ✅ อัปเดตสถานะสินค้าใน DB
                await dbClient
                    .update(products)
                    .set({ product_status: newStatus })
                    .where(eq(products.id, String(item.id)));
            }

            res.json({ success: true, message: "บันทึกออเดอร์สำเร็จ", orderId });
        } catch (err: any) {
            console.error("❌ ERROR saving sale:", err);
            res
                .status(500)
                .json({ success: false, message: err.message || "Server error" });
        }
    })
);

export default router;
