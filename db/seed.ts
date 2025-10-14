// db/seed.ts
import "dotenv/config";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import crypto from "crypto";
import bcrypt from "bcrypt";
import {
    categories,
    suppliers,
    products,
    stock_in_batches,
    stock_in,
    customers,
    employee,
    orders,
    order_items,
} from "./schema.js";
import { connectionConfig } from "./utils.js";

/* -------------------------------------------------
   🧩 Helper functions
--------------------------------------------------- */
function randInt(min: number, max: number) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randPrice(min: number, max: number) {
    const val = Math.floor(Math.random() * (max - min + 1)) + min;
    return val.toFixed(2);
}

function randChoice<T extends readonly any[]>(arr: T): T[number] {
    return arr[Math.floor(Math.random() * arr.length)];
}

function randDate(start: Date, end: Date) {
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function chunkArray<T>(arr: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
        chunks.push(arr.slice(i, i + size));
    }
    return chunks;
}

/* -------------------------------------------------
   🌱 Main seeding function
--------------------------------------------------- */
async function main() {
    const connection = await mysql.createConnection(connectionConfig);
    const db = drizzle(connection);
    console.log("🟢 Connected to database");

    await connection.query("SET FOREIGN_KEY_CHECKS = 0;");
    console.log("🧹 Clearing old data...");
    await db.delete(order_items);
    await db.delete(orders);
    await db.delete(stock_in);
    await db.delete(stock_in_batches);
    await db.delete(products);
    await db.delete(suppliers);
    await db.delete(customers);
    await db.delete(employee);
    await db.delete(categories);

    /* -------------------------- 1️⃣ Categories -------------------------- */
    console.log("🌱 Seeding categories...");
    const catNames = ["กล้อง", "เลนส์", "ขาตั้ง", "กระเป๋า", "อุปกรณ์เสริม"];
    await db.insert(categories).values(catNames.map((name, i) => ({ id: i + 1, name })));

    /* -------------------------- 2️⃣ Suppliers -------------------------- */
    console.log("🌱 Seeding suppliers...");
    await db.insert(suppliers).values([
        { id: 1, company_name: "ChiangMai Camera Co.", email: "contact@cmcamera.co.th", tel: "081-111-1111" },
        { id: 2, company_name: "Bangkok Lens Ltd.", email: "sales@bklens.com", tel: "081-222-2222" },
        { id: 3, company_name: "PhotoGear Thailand", email: "info@photogear.co.th", tel: "081-333-3333" },
    ]);

    /* -------------------------- 3️⃣ Employees -------------------------- */
    console.log("🌱 Seeding employees...");
    const password = await bcrypt.hash("1234", 10);
    await db.insert(employee).values([
        {
            id: 1,
            fname: "Owner",
            lname: "Admin",
            username: "owner",
            email: "owner@shop.local",
            password,
            employee_status: "active",
            role: "owner",
            tel: "081-000-0001",
        },
        {
            id: 2,
            fname: "Nok",
            lname: "Sale",
            username: "sale1",
            email: "sale1@shop.local",
            password,
            employee_status: "active",
            role: "sale",
            tel: "081-000-0002",
        },
        {
            id: 3,
            fname: "Ploy",
            lname: "Warehouse",
            username: "wh1",
            email: "wh1@shop.local",
            password,
            employee_status: "active",
            role: "warehouse",
            tel: "081-000-0003",
        },
    ]);

    /* -------------------------- 4️⃣ Customers -------------------------- */
    console.log("🌱 Seeding customers...");
    const fnames = ["สมชาย", "สมหญิง", "ศิริพร", "มานพ", "ณัฐ", "ปิยะ", "วรัญญา", "เกษม", "ปัทมา", "อัญชัน"];
    const lnames = ["ใจดี", "สุขใจ", "ทองดี", "เพ็ญศรี", "ศรีสุข", "เก่งกล้า", "อารี", "กล้าแกร่ง"];
    const customersData = Array.from({ length: 60 }, (_, i) => ({
        id: i + 1,
        fname: randChoice(fnames),
        lname: randChoice(lnames),
        email: `user${i + 1}@example.com`,
        tel: `08${randInt(10000000, 99999999)}`,
        address: `ที่อยู่ลูกค้า ${i + 1}`,
    }));
    await db.insert(customers).values(customersData);

    /* -------------------------- 5️⃣ Products -------------------------- */
    console.log("🌱 Seeding products...");

    type ProductStatus = typeof products.product_status.enumValues[number];

    // [ชื่อสินค้า, หมวดหมู่, ต้นทุน, ราคาขาย, รูปภาพ (optional)]
    const baseProducts: [string, number, number, number, number, ProductStatus, string?][] = [
        ["Mirrorless X100", 10, 1, 15000, 19900, "active", "https://res.cloudinary.com/dkft5klt4/image/upload/v1760391640/Fujifilm-Digital-Camera-X100-VI_ch2fyt.jpg"],
        ["DSLR Z500", 0, 1, 22000, 27900, "low_stock", "https://res.cloudinary.com/dkft5klt4/image/upload/v1760391645/n_i_nikon-z50-1_hag7sg.jpg"],
        ["Lens 50mm f1.8", 20, 2, 3500, 4990, "active", "https://res.cloudinary.com/dkft5klt4/image/upload/v1760391644/highres-Canon-EF-50mm-f1-8-STM-5_1433862749_fidswj.jpg"],
        ["Tripod Carbon Fiber Pro", 15, 3, 1800, 2490, "active", "https://res.cloudinary.com/dkft5klt4/image/upload/v1760391646/SLIK_611-896_PRO_CF-635-01_1400x_ay8hvi.webp"],
        ["Camera Bag Explorer", 5, 4, 900, 1290, "low_stock", "https://res.cloudinary.com/dkft5klt4/image/upload/v1760391644/hiking-camera-backpack-30-l-nh-explorer-900-focus-quechua-8941280_nroois.jpg"],
        ["Cleaning Kit 5in1", 2, 5, 300, 490, "low_stock", "https://res.cloudinary.com/dkft5klt4/image/upload/v1760391636/5in1Cleaning-kit3_kcjnpm.jpg"],
        ["Telephoto Lens 70-200mm", 4, 2, 18000, 23900, "low_stock", "https://res.cloudinary.com/dkft5klt4/image/upload/v1760393512/Canon-70-200mm-f28-III-IS-Review-1_do0stx.jpg"],
        ["Action Camera GoMini", 2, 1, 8500, 11900, "low_stock", "https://res.cloudinary.com/dkft5klt4/image/upload/v1760391641/HAGUE-MMC-GO-MINI-MOTION-CA__43577_psjkbk.jpg"],
        ["LED Light Panel", 30, 3, 1500, 2190, "active", "https://res.cloudinary.com/dkft5klt4/image/upload/v1760391646/VT-100w-LED-FLOODLIGHT_hr3wyz.jpg"],
        ["Drone AirShot 4K", 10, 1, 19000, 25900, "active", "https://res.cloudinary.com/dkft5klt4/image/upload/v1760391645/HS107GPSUnfolded1_1024x1024_leloap.webp"],
    ];

    const productUUIDs = baseProducts.map(() => crypto.randomUUID());

    await db.insert(products).values(
        baseProducts.map(([name, qtt, cat, cost, sell, status, image], i) => ({
            id: productUUIDs[i],
            name,
            description: `${name} คุณภาพสูง เหมาะกับมือโปร`,
            category_id: cat,
            cost: cost.toString(),
            sell: sell.toString(),
            quantity: qtt,
            counted_qty: randInt(10, 40),
            quantity_pending: 0,
            product_status: status ?? randChoice(["active", "low_stock", "restock_pending", "pricing_pending"] as const),
            image: image ?? `/images/${name.toLowerCase().replace(/ /g, "-")}.jpg`,
            last_counted_at: new Date(),
            count_note: "ตรวจเช็กสต็อกประจำเดือน",
        }))
    );

    /* -------------------------- 6️⃣ Stock-in -------------------------- */
    console.log("🌱 Seeding stock_in_batches...");
    const stockBatches = Array.from({ length: 10 }, (_, i) => ({
        id: i + 1,
        supplier_id: randInt(1, 3),
        expected_date: randDate(new Date("2025-07-14"), new Date("2025-10-14")),
        batch_status: randChoice(["completed", "some_received"] as const),
        note: `ล็อต ${i + 1}`,
    }));
    await db.insert(stock_in_batches).values(stockBatches);

    /* -------------------------- 7️⃣ Orders (เฉพาะเดือนปัจจุบัน) -------------------------- */
    console.log("🌱 Seeding orders (this month only)...");

    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1); // วันที่ 1 ของเดือนนี้
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0); // วันสุดท้ายของเดือนนี้
    const totalOrders = 100; // จำนวนออเดอร์ของเดือนนี้

    const dateGroups: Record<string, number> = {};

    function formatInvoiceNumber(date: Date, seq: number) {
        const yy = String(date.getFullYear()).slice(-2);
        const mm = String(date.getMonth() + 1).padStart(2, "0");
        const dd = String(date.getDate()).padStart(2, "0");
        const seqStr = String(seq).padStart(4, "0");
        return `INV-${yy}${mm}${dd}${seqStr}`;
    }

    const orderData = Array.from({ length: totalOrders }, (_, i) => {
        const date = randDate(startDate, endDate);
        const dateKey =
            String(date.getFullYear()).slice(-2) +
            String(date.getMonth() + 1).padStart(2, "0") +
            String(date.getDate()).padStart(2, "0");
        dateGroups[dateKey] = (dateGroups[dateKey] || 0) + 1;
        const seq = dateGroups[dateKey];
        return {
            id: i + 1,
            sale_id: 2,
            order_number: formatInvoiceNumber(date, seq),
            customer_id: randInt(1, 60),
            order_date: date,
            total_amount: randPrice(2000, 50000),
            order_status: randChoice(["completed", "canceled"] as const),
            note: `คำสั่งซื้อประจำวันที่ ${dateKey}`,
        };
    });

    await db.insert(orders).values(orderData);

    /* -------------------------- 8️⃣ Order items -------------------------- */
    console.log("🌱 Seeding order_items...");
    const seenPairs = new Set<string>();
    const orderItemData: {
        order_id: number;
        product_id: string;
        quantity: number;
        unit_price: string;
        total_price: string;
    }[] = [];

    while (orderItemData.length < 600) {
        const orderId = randInt(1, totalOrders);
        const productId = randChoice(productUUIDs);
        const key = `${orderId}-${productId}`;
        if (seenPairs.has(key)) continue;
        seenPairs.add(key);

        const qty = randInt(1, 3);
        const price = parseFloat(randPrice(500, 15000));
        orderItemData.push({
            order_id: orderId,
            product_id: productId,
            quantity: qty,
            unit_price: price.toFixed(2),
            total_price: (price * qty).toFixed(2),
        });
    }

    const chunks = chunkArray(orderItemData, 100);
    for (const chunk of chunks) {
        await db.insert(order_items).values(chunk);
    }

    await connection.query("SET FOREIGN_KEY_CHECKS = 1;");
    console.log("✅ Seed completed successfully!");
    await connection.end();
}

main().catch((err) => {
    console.error("❌ Seed failed:", err);
    process.exit(1);
});