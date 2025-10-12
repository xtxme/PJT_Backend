import { Router, Request, Response } from "express";
import { dbClient } from "@db/client.js";
import { customers, products, orders, order_items, employee } from "@db/schema.js";
import { eq, sql, desc } from "drizzle-orm";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

/* 🧍‍♀️ GET — ลูกค้าทั้งหมด */
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
            .orderBy(customers.fname);

        res.json({ success: true, data: result });
    })
);

/* 💼 GET — สินค้าทั้งหมด */
router.get(
    "/products",
    asyncHandler(async (_req: Request, res: Response) => {
        const result = await dbClient
            .select({
                id: products.id,
                name: products.name,
                price: products.sell,
                stock: products.quantity,
                status: products.status,
            })
            .from(products)
            .orderBy(products.name);

        res.json({ success: true, data: result });
    })
);

/* 🧾 POST — บันทึกใบขายใหม่ (ออกบิล) */
router.post(
    "/orders",
    asyncHandler(async (req: Request, res: Response) => {
        const { customer_id, sale_id, items, note } = req.body;

        if (!customer_id || !Array.isArray(items) || items.length === 0) {
            res.status(400).json({ success: false, message: "ข้อมูลไม่ครบถ้วน" });
            return;
        }

        // ✅ คำนวณยอดรวม
        const total_amount = items.reduce(
            (sum: number, item: any) => sum + Number(item.price) * Number(item.qty),
            0
        );

        // ✅ สร้าง order
        const [inserted] = await dbClient
            .insert(orders)
            .values({
                order_number: `INV-${Date.now().toString().slice(-6)}`,
                customer_id,
                sale_id,
                total_amount: total_amount.toString(),
                status: "completed",
                note,
                bill: null,
            })
            .$returningId();

        const orderId = inserted.id;

        // ✅ เพิ่มรายการสินค้าใน order_items
        for (const item of items) {
            await dbClient.insert(order_items).values({
                order_id: orderId,
                product_id: item.id,
                quantity: item.qty,
                unit_price: item.price.toString(),
                total_price: (item.price * item.qty).toString(),
            });

            // ✅ ตัดสต็อกสินค้า
            await dbClient
                .update(products)
                .set({
                    quantity: sql`${products.quantity} - ${item.qty}`,
                })
                .where(eq(products.id, item.id));
        }

        const [newOrder] = await dbClient
            .select({
                id: orders.id,
                order_number: orders.order_number,
                total_amount: orders.total_amount,
                customer_name: sql`CONCAT(${customers.fname}, ' ', ${customers.lname})`.as("customer_name"),
                sale_name: sql`CONCAT(${employee.fname}, ' ', ${employee.lname})`.as("sale_name"),
                order_date: orders.order_date,
                status: orders.status,
            })
            .from(orders)
            .leftJoin(customers, eq(orders.customer_id, customers.id))
            .leftJoin(employee, eq(orders.sale_id, employee.id))
            .where(eq(orders.id, orderId));

        res.json({
            success: true,
            message: "สร้างใบขายสำเร็จ ✅",
            data: newOrder,
        });
    })
);

/* 🔍 GET — รายละเอียดใบขายเดี่ยว */
router.get(
    "/orders/:id",
    asyncHandler(async (req: Request, res: Response) => {
        const id = Number(req.params.id);

        const [orderDetail] = await dbClient
            .select({
                id: orders.id,
                order_number: orders.order_number,
                customer_name: sql`CONCAT(${customers.fname}, ' ', ${customers.lname})`.as("customer_name"),
                total_amount: orders.total_amount,
                order_date: orders.order_date,
                status: orders.status,
            })
            .from(orders)
            .leftJoin(customers, eq(orders.customer_id, customers.id))
            .where(eq(orders.id, id));

        if (!orderDetail) {
            res.status(404).json({ success: false, message: "ไม่พบใบขายนี้" });
            return;
        }

        const items = await dbClient
            .select({
                product_id: order_items.product_id,
                quantity: order_items.quantity,
                unit_price: order_items.unit_price,
                total_price: order_items.total_price,
            })
            .from(order_items)
            .where(eq(order_items.order_id, id));

        res.json({
            success: true,
            data: { ...orderDetail, items },
        });
    })
);

export default router;
