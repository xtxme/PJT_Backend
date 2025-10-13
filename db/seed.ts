// seed.ts
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import {
    categories,
    suppliers,
    products,
    stock_in,
    stock_in_batches,
    customers,
    employee,
    orders,
    order_items,
} from "./schema.js";
import { connectionConfig } from "./utils.js";
import bcrypt from "bcrypt";

async function main() {
    const connection = await mysql.createConnection(connectionConfig);
    const passwordHash = await bcrypt.hash("password123", 10);
    const db = drizzle(connection);

    // ---- ล้างข้อมูลเก่าแบบระวังลำดับ FK (เลือกใช้หรือตัดทิ้งได้) ----
    // ลบลูกก่อนค่อยลบพ่อแม่
    await db.delete(order_items);
    await db.delete(orders);
    await db.delete(stock_in);
    await db.delete(stock_in_batches);
    await db.delete(products);
    await db.delete(suppliers);
    await db.delete(customers);
    await db.delete(employee);
    await db.delete(categories);

    // ---- 1) master: categories ----
    await db.insert(categories).values([
        { id: 1, name: "กล้อง" },
        { id: 2, name: "เลนส์" },
        { id: 3, name: "อุปกรณ์เสริม" },
    ]);

    // ---- 2) master: suppliers ----
    await db.insert(suppliers).values([
        { id: 1, company_name: "ChiangMai Camera Co.", email: "contact@cm-camera.co", tel: "080-111-1111" },
        { id: 2, company_name: "Bangkok Lens Ltd.", email: "sales@bklens.com", tel: "080-222-2222" },
    ]);

    // ---- 3) master: customers ----
    await db.insert(customers).values([
        { id: 1, fname: "Somchai", lname: "W.", email: "somchai@example.com", tel: "089-000-1000" },
        { id: 2, fname: "Suda", lname: "K.", email: "suda@example.com", tel: "089-000-2000" },
        { id: 3, fname: "Anan", lname: "T.", email: "anan@example.com", tel: "089-000-3000" },
    ]);

    // ---- 4) master: employee (ใส่รหัสผ่านตัวอย่างเป็น bcrypt hash ของ "password") ----
    // hash ต่อไปนี้คือ bcrypt ของ "password" (cost 10): $2b$10$CwTycUXWue0Thq9StjUM0uJ8b8bHkI4tVQ3o7S0VQd6r5fHjYF5lK
    await db.insert(employee).values([
        {
            id: 1,
            fname: "Owner",
            lname: "Ice",
            username: "owner",
            employee_status: "active",
            tel: "081-123-4567",
            role: "owner",
            email: "owner@gmail.com",
            password: passwordHash,//password123
        },
        {
            id: 2,
            fname: "Sale",
            lname: "Morpor",
            username: "sale1",
            employee_status: "active",
            tel: "081-222-3333",
            role: "sale",
            email: "sale1@gmail.com",
            password: passwordHash,//password123
        },
        {
            id: 3,
            fname: "Warehouse",
            lname: "Prae",
            username: "warehouse1",
            employee_status: "active",
            tel: "081-222-3334",
            role: "warehouse",
            email: "warehouse1@gmail.com",
            password: passwordHash,//password123
        }
    ]);

    const productSeeds = [
        {
            id: "prod-0001-x100",
            image: null,
            name: "Mirrorless X100",
            description: "กล้อง mirrorless ใช้งานอเนกประสงค์",
            category_id: 1,
            unit: "pcs",
            cost: "15000.00",
            sell: "19900.00",
            quantity: 10,
            quantity_pending: 0,
            company: "CM Brand",
            product_status: "active",
        },
        {
            id: "prod-0002-lens50",
            image: null,
            name: "Lens 50mm f1.8",
            description: "เลนส์ระยะมาตรฐาน",
            category_id: 2,
            unit: "pcs",
            cost: "3500.00",
            sell: "4990.00",
            quantity: 20,
            quantity_pending: 0,
            company: "BK Lens",
            product_status: "active",
        },
        {
            id: "prod-0003-tripod",
            image: null,
            name: "Tripod Carbon",
            description: "ขาตั้งคาร์บอน น้ำหนักเบา",
            category_id: 3,
            unit: "pcs",
            cost: "1800.00",
            sell: "2490.00",
            quantity: 15,
            quantity_pending: 0,
            company: "AccWorks",
            product_status: "active",
        },
    ] satisfies typeof products.$inferInsert[];

    // ---- 5) products (FK -> categories.id) ----
    await db.insert(products).values(productSeeds);

    const stockInBatchSeeds = [
        {
            id: 1,
            supplier_id: 1,
            expected_date: new Date("2025-01-05T00:00:00Z"),
            batch_status: "completed",
            note: "ล็อตเปิดร้าน",
        },
        {
            id: 2,
            supplier_id: 2,
            expected_date: new Date("2025-01-10T00:00:00Z"),
            batch_status: "completed",
            note: "รีสต๊อกสินค้าประจำฤดูกาล",
        },
    ] satisfies typeof stock_in_batches.$inferInsert[];

    await db.insert(stock_in_batches).values(stockInBatchSeeds);

    const stockInSeeds = [
        {
            id: 1,
            batch_id: 1,
            product_id: productSeeds[0].id,
            quantity: 5,
            received_qty: 5,
            supplier_id: 1,
            unit_cost: "15000.00",
            stock_in_status: "completed",
            note: "ล็อตเปิดร้าน",
            received_date: new Date("2025-01-06T00:00:00Z"),
        },
        {
            id: 2,
            batch_id: 2,
            product_id: productSeeds[1].id,
            quantity: 10,
            received_qty: 10,
            supplier_id: 2,
            unit_cost: "3500.00",
            stock_in_status: "completed",
            note: "รีสต๊อกเลนส์ 50mm",
            received_date: new Date("2025-01-11T00:00:00Z"),
        },
        {
            id: 3,
            batch_id: 2,
            product_id: productSeeds[2].id,
            quantity: 5,
            received_qty: 3,
            supplier_id: 1,
            unit_cost: "1800.00",
            stock_in_status: "some_received",
            note: "ยังค้างรับ 2 ชิ้น",
            received_date: new Date("2025-01-12T00:00:00Z"),
        },
    ] satisfies typeof stock_in.$inferInsert[];

    // ---- 6) stock_in (FK -> products.id, suppliers.id) ----
    await db.insert(stock_in).values(stockInSeeds);

    const orderSeeds = [
        {
            id: 1,
            sale_id: 2, // พนักงานขาย sale1
            order_number: "ORD-2025-0001",
            customer_id: 1, // Somchai
            total_amount: "24890.00",
            order_status: "completed",
            note: "ลูกค้าประจำ",
            bill: null,
        },
        {
            id: 2,
            sale_id: 2,
            order_number: "ORD-2025-0002",
            customer_id: 2, // Suda
            total_amount: "4990.00",
            order_status: "completed",
            note: null,
            bill: null,
        },
    ] satisfies typeof orders.$inferInsert[];

    // ---- 7) orders (FK -> employee.id, customers.id) ----
    await db.insert(orders).values(orderSeeds);

    // ---- 8) order_items (FK -> orders.id, products.id) ----
    await db.insert(order_items).values([
        {
            id: 1,
            order_id: 1,
            product_id: productSeeds[0].id, // Mirrorless X100
            quantity: 1,
            unit_price: "19900.00",
            total_price: "19900.00",
        },
        {
            id: 2,
            order_id: 1,
            product_id: productSeeds[2].id, // Tripod
            quantity: 2,
            unit_price: "2490.00",
            total_price: "4980.00",
        },
        {
            id: 3,
            order_id: 2,
            product_id: productSeeds[1].id, // Lens 50mm
            quantity: 1,
            unit_price: "4990.00",
            total_price: "4990.00",
        },
    ]);

    // อัปเดตยอดรวม order ให้ตรงกับ items (กันพลาดถ้าปรับภายหลัง)
    await connection.execute(
        `UPDATE orders o
       JOIN (
         SELECT order_id, SUM(total_price) AS sum_total
         FROM order_items
         GROUP BY order_id
       ) x ON x.order_id = o.id
     SET o.total_amount = x.sum_total`
    );

    await connection.end();
    console.log("✅ Seed completed.");
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
