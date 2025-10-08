import { dbClient } from "@db/client.js";
import bcrypt from "bcrypt";
import { employee } from "@db/schema.js";
import { orders } from "@db/schema.js";
import { products } from "@db/schema.js";

async function seedEmployees() {
    const hashedPassword = await bcrypt.hash("1234", 10); // same for all demo users

    await dbClient.insert(employee).values([
        {
            fname: "Owner",
            lname: "User",
            username: "owner_user",
            status: "active",
            tel: "0812345678",
            role: "owner",
            email: "prae.tippy@gmail.com",
            password: hashedPassword, // ✅ hashed
        },
        {
            fname: "Sale",
            lname: "User",
            username: "sale_user",
            status: "active",
            tel: "0899999999",
            role: "sale",
            email: "prts0774@gmail.com",
            password: hashedPassword, // ✅ hashed
        },
        {
            fname: "Warehouse",
            lname: "User",
            username: "warehouse_user",
            status: "active",
            tel: "0822222222",
            role: "warehouse",
            email: "warehouse@gmail.com",
            password: hashedPassword, // ✅ hashed
        },
    ]);

    console.log("Employees seeded");
}

async function seedProducts() {
    await dbClient.insert(products).values([
        {
            image: "https://example.com/images/arabica-beans.jpg",
            name: "Arabica Coffee Beans 1kg",
            description: "Single-origin medium roast beans with rich chocolate notes.",
            category_id: 1,
            unit: 1000, // grams
            cost: 450,
            sell: 690,
            profit: 240,
            quantity: 120,
            quantity_pending: 15,
            company: "Northern Brew Co.",
            created_at: new Date(),
            updated_at: new Date(),
        },
        {
            image: "https://example.com/images/cold-brew.jpg",
            name: "Cold Brew Concentrate 500ml",
            description: "Slow-steeped concentrate ready to dilute for iced coffee.",
            category_id: 2,
            unit: 500, // milliliters
            cost: 160,
            sell: 320,
            profit: 160,
            quantity: 80,
            quantity_pending: 10,
            company: "ChillDrip Labs",
            created_at: new Date(),
            updated_at: new Date(),
        },
        {
            image: "https://example.com/images/oat-milk.jpg",
            name: "Barista Oat Milk 1L",
            description: "Foam-friendly oat milk made for espresso-based drinks.",
            category_id: 3,
            unit: 1000, // milliliters
            cost: 55,
            sell: 95,
            profit: 40,
            quantity: 200,
            quantity_pending: 25,
            company: "Velvet Creamery",
            created_at: new Date(),
            updated_at: new Date(),
        },
        {
            image: "https://example.com/images/caramel-syrup.jpg",
            name: "Caramel Syrup 750ml",
            description: "Classic caramel syrup for lattes and frappes.",
            category_id: 2,
            unit: 750, // milliliters
            cost: 120,
            sell: 210,
            profit: 90,
            quantity: 95,
            quantity_pending: 12,
            company: "Sweetnote Artisan",
            created_at: new Date(),
            updated_at: new Date(),
        },
        {
            image: "https://example.com/images/espresso-cups.jpg",
            name: "Porcelain Espresso Cups (Set of 4)",
            description: "Double-walled cups that keep espresso warm longer.",
            category_id: 4,
            unit: 4, // pieces
            cost: 180,
            sell: 320,
            profit: 140,
            quantity: 60,
            quantity_pending: 8,
            company: "Ceramo Supply",
            created_at: new Date(),
            updated_at: new Date(),
        },
    ]);

    console.log("Products seeded");
}

async function seedOrders() {
    await dbClient.insert(orders).values([
        {
            id: 1,
            sale_id: 2,
            order_number: "ORD-2025001",
            customer_id: 1,
            order_date: new Date("2025-01-10T09:15:00Z"),
            total_amount: "1540.00",
            status: "completed",
            note: "First wholesale order of the year.",
            bill: "https://example.com/bills/ORD-2025001.pdf",
            created_at: new Date("2025-01-10T09:20:00Z"),
            updated_at: new Date("2025-01-10T09:20:00Z"),
        },
        {
            id: 2,
            sale_id: 2,
            order_number: "ORD-2025002",
            customer_id: 2,
            order_date: new Date("2025-01-12T14:05:00Z"),
            total_amount: "875.50",
            status: "processing",
            note: "Customer requested split shipment.",
            bill: "https://example.com/bills/ORD-2025002.pdf",
            created_at: new Date("2025-01-12T14:10:00Z"),
            updated_at: new Date("2025-01-13T08:00:00Z"),
        },
        {
            id: 3,
            sale_id: 7,
            order_number: "ORD-2025003",
            customer_id: 3,
            order_date: new Date("2025-01-15T11:30:00Z"),
            total_amount: "2340.75",
            status: "completed",
            note: "Includes promotional discount applied manually.",
            bill: "https://example.com/bills/ORD-2025003.pdf",
            created_at: new Date("2025-01-15T11:40:00Z"),
            updated_at: new Date("2025-01-15T11:40:00Z"),
        },
        {
            id: 4,
            sale_id: 7,
            order_number: "ORD-2025004",
            customer_id: 4,
            order_date: new Date("2025-01-18T16:45:00Z"),
            total_amount: "460.00",
            status: "pending",
            note: "Awaiting payment confirmation.",
            bill: "https://example.com/bills/ORD-2025004.pdf",
            created_at: new Date("2025-01-18T16:50:00Z"),
            updated_at: new Date("2025-01-18T16:50:00Z"),
        },
        {
            id: 5,
            sale_id: 7,
            order_number: "ORD-2025005",
            customer_id: 5,
            order_date: new Date("2025-01-20T08:25:00Z"),
            total_amount: "1280.40",
            status: "cancelled",
            note: "Cancelled due to out-of-stock items.",
            bill: "https://example.com/bills/ORD-2025005.pdf",
            created_at: new Date("2025-01-20T08:30:00Z"),
            updated_at: new Date("2025-01-21T09:00:00Z"),
        },
    ]);

    console.log("Orders seeded");
}

async function runSeed() {
    await seedEmployees();
    await seedProducts();
    await seedOrders();
}

runSeed()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
