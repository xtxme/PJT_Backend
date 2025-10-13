import { Router, Request, Response, NextFunction } from "express";
import { dbClient } from "@db/client.js";
import { customers, orders } from "@db/schema.js";
import { eq, sql } from "drizzle-orm";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

/* 🟩 GET: ดึงลูกค้าพร้อมยอดรวมเฉพาะ order ที่ completed */
router.get(
    "/",
    asyncHandler(async (_req: Request, res: Response, _next: NextFunction) => {
        const result = await dbClient
            .select({
                id: customers.id,
                name: sql`CONCAT(${customers.fname}, ' ', ${customers.lname})`,
                address: sql`MIN(${customers.address})`,
                email: sql`MIN(${customers.email})`,
                tel: sql`MIN(${customers.tel})`,
                totalPaid: sql`
          COALESCE(SUM(
            CASE 
              WHEN ${orders.order_status} = 'completed' 
              THEN ${orders.total_amount} 
              ELSE 0 
            END
          ), 0)
        `,
            })
            .from(customers)
            .leftJoin(orders, eq(customers.id, orders.customer_id))
            .groupBy(customers.id);

        res.json({ success: true, data: result });
    })
);

/* 🟨 GET /sale/customers/search?keyword=<name> */
router.get(
    "/search",
    asyncHandler(async (req: Request, res: Response) => {
        const keyword = String(req.query.keyword || "").trim();

        const baseSelect = {
            id: customers.id,
            name: sql`CONCAT(${customers.fname}, ' ', ${customers.lname})`,
            address: customers.address,
            email: customers.email,
            tel: customers.tel,
            totalPaid: sql`
        COALESCE(SUM(
          CASE 
            WHEN ${orders.order_status} = 'completed' 
            THEN ${orders.total_amount} 
            ELSE 0 
          END
        ), 0)
      `,
        };

        // ถ้าไม่ใส่ keyword — แสดงทั้งหมด
        if (!keyword) {
            const all = await dbClient
                .select(baseSelect)
                .from(customers)
                .leftJoin(orders, eq(customers.id, orders.customer_id))
                .groupBy(customers.id)
                .orderBy(customers.id);

            res.json({ success: true, data: all });
        }

        // ถ้ามี keyword — ค้นหาเฉพาะชื่อ อีเมล หรือเบอร์
        const result = await dbClient
            .select(baseSelect)
            .from(customers)
            .leftJoin(orders, eq(customers.id, orders.customer_id))
            .where(
                sql`CONCAT(${customers.fname}, ' ', ${customers.lname}) LIKE ${'%' + keyword + '%'}
             OR ${customers.email} LIKE ${'%' + keyword + '%'}
             OR ${customers.tel} LIKE ${'%' + keyword + '%'}`
            )
            .groupBy(customers.id)
            .orderBy(customers.id);

        res.json({ success: true, data: result });
    })
);

/* 🟦 POST: เพิ่มลูกค้าใหม่ */
router.post(
    "/",
    asyncHandler(async (req: Request, res: Response) => {
        const { name, address, email, tel, totalPaid } = req.body;
        if (!name || !address) {
            res.status(400).json({ success: false, message: "กรุณากรอกชื่อและที่อยู่" });
            return;
        }

        const [fname, lname = ""] = name.split(" ");
        const [inserted] = await dbClient
            .insert(customers)
            .values({ fname, lname, address, email, tel })
            .$returningId();

        const newCustomerId = inserted.id;

        // ✅ ถ้ามี totalPaid ให้สร้างบิล completed แรก
        if (Number(totalPaid) > 0) {
            await dbClient.insert(orders).values({
                customer_id: newCustomerId,
                order_number: `INIT-${Date.now()}`,
                total_amount: totalPaid,
                order_status: "completed",
            });
        }

        // ✅ ดึงลูกค้าใหม่พร้อมยอดรวมเฉพาะ completed
        const [newCustomer] = await dbClient
            .select({
                id: customers.id,
                name: sql`CONCAT(${customers.fname}, ' ', ${customers.lname})`,
                address: customers.address,
                email: customers.email,
                tel: customers.tel,
                totalPaid: sql`
          COALESCE(SUM(
            CASE 
              WHEN ${orders.order_status} = 'completed' 
              THEN ${orders.total_amount} 
              ELSE 0 
            END
          ), ${totalPaid || 0})
        `,
            })
            .from(customers)
            .leftJoin(orders, eq(customers.id, orders.customer_id))
            .where(eq(customers.id, newCustomerId))
            .groupBy(customers.id);

        res.json({ success: true, data: newCustomer });
    })
);

/* 🟦 PUT — แก้ไขข้อมูลลูกค้า */
router.put("/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = Number(req.params.id);
        const { name, address, email, tel, totalPaid } = req.body;
        const [fname, lname = ""] = name.split(" ");

        await dbClient
            .update(customers)
            .set({ fname, lname, address, email, tel })
            .where(eq(customers.id, id));

        // ✅ รวมยอดเฉพาะ completed
        const [updated] = await dbClient
            .select({
                id: customers.id,
                name: sql`CONCAT(${customers.fname}, ' ', ${customers.lname})`,
                address: customers.address,
                email: customers.email,
                tel: customers.tel,
                totalPaid: sql`
          COALESCE(SUM(
            CASE 
              WHEN ${orders.order_status} = 'completed' 
              THEN ${orders.total_amount} 
              ELSE 0 
            END
          ), ${totalPaid || 0})
        `,
            })
            .from(customers)
            .leftJoin(orders, eq(customers.id, orders.customer_id))
            .where(eq(customers.id, id))
            .groupBy(customers.id);

        res.json({ success: true, data: updated });
    } catch (err) {
        console.error("❌ แก้ไขลูกค้าล้มเหลว:", err);
        next(err);
    }
});

export default router;
