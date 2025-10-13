import { Router } from "express";
import { dbClient } from "@db/client.js";
import { products } from "@db/schema.js";
import { eq } from "drizzle-orm";

const router = Router();

/* ============================
   📦 ดึงรายการสินค้าทั้งหมด (สำหรับการนับสต็อก)
============================ */
router.get("/stock", async (_req, res, next) => {
    try {
        // ดึงข้อมูลจากตาราง products
        const result = await dbClient
            .select({
                id: products.id,
                image: products.image,
                name: products.name,
                company: products.company,
                lastUpdate: products.last_counted_at,
                systemQty: products.quantity,
                latestQty: products.counted_qty,
            })
            .from(products);

        // เพิ่ม field "match" (true ถ้าจำนวนตรงกัน)
        const formatted = result.map((p) => ({
            ...p,
            newQty: p.latestQty ?? 0,
            match: p.systemQty === p.latestQty,
        }));

        res.json(formatted);
    } catch (err) {
        next(err);
    }
});

/* ============================
   🧮 อัปเดตจำนวนสินค้าที่นับจริง (counted_qty)
   ใช้ตอนกด “บันทึก/ยืนยันการนับ”
============================ */
router.put("/stock/:id", async (req, res, next) => {
    try {
        const { id } = req.params;
        const { counted_qty, count_note } = req.body;

        // ตรวจสอบ input เบื้องต้น
        if (counted_qty == null || isNaN(Number(counted_qty))) {
            return res.status(400).json({ error: "กรุณาระบุจำนวนที่นับเป็นตัวเลข" });
        }

        // อัปเดตในฐานข้อมูล
        const updated = await dbClient
            .update(products)
            .set({
                counted_qty: Number(counted_qty),
                last_counted_at: new Date(),
                count_note: count_note ?? null,
            })
            .where(eq(products.id, id));

        if (updated[0].affectedRows === 0) {
            return res.status(404).json({ error: "ไม่พบสินค้านี้" });
        }

        res.json({ message: "อัปเดตจำนวนสินค้าสำเร็จ", product_id: id });
    } catch (err) {
        next(err);
    }
});

export default router;
