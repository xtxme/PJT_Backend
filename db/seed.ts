import "dotenv/config";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import crypto from "crypto";
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
} from "./schema.js"; // ✅ ปรับ path ให้ตรงกับโปรเจกต์คุณ
import { connectionConfig } from "./utils.js";

async function main() {
    const connection = await mysql.createConnection(connectionConfig);
    const db = drizzle(connection);
    console.log("🟢 Connected to database");

    // ลบข้อมูลเก่าตามลำดับ FK
    console.log("🧹 Clearing old data...");
    await db.delete(order_items);
    await db.delete(orders);
    await db.delete(stock_in_batches);
    await db.delete(stock_in);
    await db.delete(products);
    await db.delete(suppliers);
    await db.delete(customers);
    await db.delete(employee);
    await db.delete(categories);

    /* =========================
       1️⃣ CATEGORIES
    ========================= */
    console.log("🌱 Seeding categories...");
    await db.insert(categories).values([
        { id: 1, name: "กล้อง" },
        { id: 2, name: "เลนส์" },
        { id: 3, name: "อุปกรณ์เสริม" },
    ]);

    /* =========================
       2️⃣ SUPPLIERS
    ========================= */
    console.log("🌱 Seeding suppliers...");
    await db.insert(suppliers).values([
        {
            id: 1,
            company_name: "ChiangMai Camera Co.",
            email: "contact@cmcamera.co.th",
            tel: "081-111-1111",
        },
        {
            id: 2,
            company_name: "Bangkok Lens Ltd.",
            email: "sales@bklens.com",
            tel: "081-222-2222",
        },
    ]);

    /* =========================
       3️⃣ CUSTOMERS
    ========================= */
    console.log("🌱 Seeding customers...");
    await db.insert(customers).values([
        { id: 1, fname: "สมชาย", lname: "ใจดี", email: "somchai@example.com", tel: "0811111111" },
        { id: 2, fname: "สมหญิง", lname: "ใจงาม", email: "somying@example.com", tel: "0822222222" },
    ]);

    /* =========================
       4️⃣ EMPLOYEE
    ========================= */
    console.log("🌱 Seeding employees...");
    // bcrypt hash ของคำว่า "password"
    const passwordHash =
        "$2b$10$CwTycUXWue0Thq9StjUM0uJ8b8bHkI4tVQ3o7S0VQd6r5fHjYF5lK";

    await db.insert(employee).values([
        {
            id: 1,
            fname: "Owner",
            lname: "Admin",
            username: "owner",
            email: "owner@shop.local",
            password: passwordHash,
            employee_status: "active",
            role: "owner",
            tel: "081-123-4567",
        },
        {
            id: 2,
            fname: "Nok",
            lname: "Sale",
            username: "sale1",
            email: "sale1@shop.local",
            password: passwordHash,
            employee_status: "active",
            role: "sale",
            tel: "081-222-3333",
        },
        {
            id: 3,
            fname: "Ploy",
            lname: "Warehouse",
            username: "wh1",
            email: "wh1@shop.local",
            password: passwordHash,
            employee_status: "active",
            role: "warehouse",
            tel: "081-333-4444",
        },
    ]);

    /* =========================
       5️⃣ PRODUCTS
    ========================= */
    console.log("🌱 Seeding products...");
    const p1 = crypto.randomUUID();
    const p2 = crypto.randomUUID();
    const p3 = crypto.randomUUID();

    await db.insert(products).values([
        {
            id: p1,
            name: "Mirrorless X100",
            description: "กล้อง mirrorless ใช้งานอเนกประสงค์",
            image: "/images/camera-x100.jpg",
            category_id: 1,
            unit: "ตัว",
            cost: "15000.00",
            sell: "19900.00",
            quantity: 10,
            counted_qty: 9,
            quantity_pending: 1,
            last_counted_at: new Date("2025-10-10T10:00:00"),
            count_note: "ของหาย 1 ตัว",
            company: "ChiangMai Camera Co.",
            product_status: "active",
        },
        {
            id: p2,
            name: "Lens 50mm f1.8",
            description: "เลนส์ระยะมาตรฐาน",
            image: "/images/lens-50mm.jpg",
            category_id: 2,
            unit: "ชิ้น",
            cost: "3500.00",
            sell: "4990.00",
            quantity: 20,
            counted_qty: 20,
            quantity_pending: 0,
            last_counted_at: new Date("2025-10-05T11:00:00"),
            company: "Bangkok Lens Ltd.",
            product_status: "active",
        },
        {
            id: p3,
            name: "Tripod Carbon",
            description: "ขาตั้งคาร์บอนไฟเบอร์ น้ำหนักเบา",
            image: "/images/tripod-carbon.jpg",
            category_id: 3,
            unit: "ตัว",
            cost: "1800.00",
            sell: "2490.00",
            quantity: 15,
            counted_qty: 17,
            quantity_pending: 2,
            last_counted_at: new Date("2025-10-09T09:00:00"),
            count_note: "มีของค้างในโกดัง",
            company: "ChiangMai Camera Co.",
            product_status: "restock_pending",
        },
    ]);
    /* =========================
       6️⃣ STOCK_IN_BATCHES
    ========================= */
    console.log("🌱 Seeding stock_in_batches...");
    await db.insert(stock_in_batches).values([
        {
            id: 1,
            supplier_id: 1,
            expected_date: new Date("2025-10-01T10:00:00"),
            batch_status: "completed",
            note: "ล็อตเปิดร้าน",
        },
        {
            id: 2,
            supplier_id: 2,
            expected_date: new Date("2025-10-05T09:00:00"),
            batch_status: "completed",
            note: "รีสต๊อกเลนส์ 50mm",
        },
        {
            id: 3,
            supplier_id: 1,
            expected_date: new Date("2025-10-07T15:00:00"),
            batch_status: "some_received",
            note: "รอของอีก 2 ชิ้น",
        },
    ]);

    /* =========================
       6️⃣ STOCK_IN
    ========================= */
    console.log("🌱 Seeding stock_in...");
    await db.insert(stock_in).values([
        {
            id: 1,
            batch_id: 1,
            product_id: p1,
            quantity: 5,
            received_qty: 5,
            supplier_id: 1,
            unit_cost: "15000.00",
            stock_in_status: "completed",
            note: "ล็อตแรกเปิดร้าน",
        },
        {
            id: 2,
            batch_id: 2,
            product_id: p2,
            quantity: 10,
            received_qty: 10,
            supplier_id: 2,
            unit_cost: "3500.00",
            stock_in_status: "completed",
            note: "สั่งเพิ่มรอบเดือนตุลา",
        },
        {
            id: 3,
            batch_id: 3,
            product_id: p3,
            quantity: 5,
            received_qty: 3,
            supplier_id: 1,
            unit_cost: "1800.00",
            stock_in_status: "some_received",
            note: "รออีก 2 ชิ้น",
        },
    ]);

    /* =========================
       7️⃣ ORDERS
    ========================= */
    console.log("🌱 Seeding orders...");
    await db.insert(orders).values([
        {
            id: 1,
            sale_id: 2,
            order_number: "ORD-2025-0001",
            customer_id: 1,
            total_amount: "22380.00",
            order_status: "completed",
            note: "ลูกค้าประจำซื้อกล้อง+เลนส์",
        },
        {
            id: 2,
            sale_id: 2,
            order_number: "ORD-2025-0002",
            customer_id: 2,
            total_amount: "2490.00",
            order_status: "completed",
            note: "สั่งขาตั้งเพิ่ม",
        },
    ]);

    /* =========================
       8️⃣ ORDER_ITEMS
    ========================= */
    console.log("🌱 Seeding order_items...");
    await db.insert(order_items).values([
        {
            id: 1,
            order_id: 1,
            product_id: p1,
            quantity: 1,
            unit_price: "19900.00",
            total_price: "19900.00",
        },
        {
            id: 2,
            order_id: 1,
            product_id: p2,
            quantity: 1,
            unit_price: "4990.00",
            total_price: "4990.00",
        },
        {
            id: 3,
            order_id: 2,
            product_id: p3,
            quantity: 1,
            unit_price: "2490.00",
            total_price: "2490.00",
        },
    ]);

    console.log("✅ Seed completed successfully!");
    await connection.end();
}

main().catch((err) => {
    console.error("❌ Seed failed:", err);
    process.exit(1);
});
