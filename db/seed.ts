import { dbClient } from "@db/client.js";
import bcrypt from "bcrypt";
import { and, eq, inArray } from "drizzle-orm";
import { employee, order_items, orders, products, stock_in } from "@db/schema.js";

type OrderItemInsert = typeof order_items.$inferInsert;

async function seedEmployees() {
    const hashedPassword = await bcrypt.hash("1234", 10); // same for all demo users

    const employeesToSeed = [
        {
            fname: "Owner",
            lname: "User",
            username: "owner_user",
            status: "active",
            tel: "0812345678",
            role: "owner",
            email: "prae.tippy@gmail.com",
        },
        {
            fname: "Sale",
            lname: "User",
            username: "sale_user",
            status: "active",
            tel: "0899999999",
            role: "sale",
            email: "prts0774@gmail.com",
        },
        {
            fname: "Warehouse",
            lname: "User",
            username: "warehouse_user",
            status: "active",
            tel: "0822222222",
            role: "warehouse",
            email: "warehouse@gmail.com",
        },
    ];

    let inserted = 0;

    for (const employeeData of employeesToSeed) {
        const existing = await dbClient.query.employee.findFirst({
            where: eq(employee.username, employeeData.username),
        });

        if (existing) {
            continue;
        }

        await dbClient.insert(employee).values({
            ...employeeData,
            password: hashedPassword, // ✅ hashed
        });

        inserted += 1;
    }

    console.log(`Employees seeded (${inserted} new)`);
}

async function seedProducts() {
    const productsToSeed = [
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
    ];

    let inserted = 0;

    for (const product of productsToSeed) {
        const existing = await dbClient.query.products.findFirst({
            where: eq(products.name, product.name),
        });

        if (existing) {
            continue;
        }

        await dbClient.insert(products).values(product);
        inserted += 1;
    }

    console.log(`Products seeded (${inserted} new)`);
}

async function seedOrders() {
    const ordersToSeed = [
        {
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
        {
            sale_id: 2,
            order_number: "ORD-20250901",
            customer_id: 2,
            order_date: new Date("2025-09-03T10:10:00Z"),
            total_amount: "980.00",
            status: "completed",
            note: "Monthly restock of espresso beans.",
            bill: "https://example.com/bills/ORD-20250901.pdf",
            created_at: new Date("2025-09-03T10:15:00Z"),
            updated_at: new Date("2025-09-03T10:15:00Z"),
        },
        {
            sale_id: 2,
            order_number: "ORD-20250902",
            customer_id: 4,
            order_date: new Date("2025-09-07T13:20:00Z"),
            total_amount: "1645.50",
            status: "processing",
            note: "Includes custom grinding instructions.",
            bill: "https://example.com/bills/ORD-20250902.pdf",
            created_at: new Date("2025-09-07T13:25:00Z"),
            updated_at: new Date("2025-09-08T09:00:00Z"),
        },
        {
            sale_id: 7,
            order_number: "ORD-20250903",
            customer_id: 6,
            order_date: new Date("2025-09-12T09:45:00Z"),
            total_amount: "720.25",
            status: "completed",
            note: "Rush delivery for weekend event.",
            bill: "https://example.com/bills/ORD-20250903.pdf",
            created_at: new Date("2025-09-12T09:50:00Z"),
            updated_at: new Date("2025-09-12T09:50:00Z"),
        },
        {
            sale_id: 7,
            order_number: "ORD-20250904",
            customer_id: 3,
            order_date: new Date("2025-09-18T15:05:00Z"),
            total_amount: "2100.00",
            status: "pending",
            note: "Awaiting confirmation on seasonal syrups.",
            bill: "https://example.com/bills/ORD-20250904.pdf",
            created_at: new Date("2025-09-18T15:10:00Z"),
            updated_at: new Date("2025-09-18T15:10:00Z"),
        },
        {
            sale_id: 2,
            order_number: "ORD-20250905",
            customer_id: 5,
            order_date: new Date("2025-09-25T17:55:00Z"),
            total_amount: "1340.80",
            status: "completed",
            note: "Includes complimentary training kit.",
            bill: "https://example.com/bills/ORD-20250905.pdf",
            created_at: new Date("2025-09-25T18:00:00Z"),
            updated_at: new Date("2025-09-25T18:00:00Z"),
        },
        {
            sale_id: 2,
            order_number: "ORD-20251001",
            customer_id: 1,
            order_date: new Date("2025-10-02T08:40:00Z"),
            total_amount: "1585.00",
            status: "completed",
            note: "Quarterly supply bundle with new grinder.",
            bill: "https://example.com/bills/ORD-20251001.pdf",
            created_at: new Date("2025-10-02T08:45:00Z"),
            updated_at: new Date("2025-10-02T08:45:00Z"),
        },
        {
            sale_id: 7,
            order_number: "ORD-20251002",
            customer_id: 7,
            order_date: new Date("2025-10-06T12:15:00Z"),
            total_amount: "945.60",
            status: "processing",
            note: "New café opening package.",
            bill: "https://example.com/bills/ORD-20251002.pdf",
            created_at: new Date("2025-10-06T12:20:00Z"),
            updated_at: new Date("2025-10-07T09:30:00Z"),
        },
        {
            sale_id: 10,
            order_number: "ORD-20251003",
            customer_id: 2,
            order_date: new Date("2025-10-10T14:55:00Z"),
            total_amount: "1875.30",
            status: "completed",
            note: "Includes seasonal promotional items.",
            bill: "https://example.com/bills/ORD-20251003.pdf",
            created_at: new Date("2025-10-10T15:00:00Z"),
            updated_at: new Date("2025-10-10T15:00:00Z"),
        },
        {
            sale_id: 10,
            order_number: "ORD-20251004",
            customer_id: 4,
            order_date: new Date("2025-10-15T10:30:00Z"),
            total_amount: "560.40",
            status: "pending",
            note: "Waiting for approval on custom labels.",
            bill: "https://example.com/bills/ORD-20251004.pdf",
            created_at: new Date("2025-10-15T10:35:00Z"),
            updated_at: new Date("2025-10-15T10:35:00Z"),
        },
        {
            sale_id: 10,
            order_number: "ORD-20251005",
            customer_id: 6,
            order_date: new Date("2025-10-20T19:10:00Z"),
            total_amount: "2220.90",
            status: "processing",
            note: "High-volume order for corporate event.",
            bill: "https://example.com/bills/ORD-20251005.pdf",
            created_at: new Date("2025-10-20T19:15:00Z"),
            updated_at: new Date("2025-10-21T08:00:00Z"),
        },
    ];

    let inserted = 0;

    for (const order of ordersToSeed) {
        const existing = await dbClient.query.orders.findFirst({
            where: eq(orders.order_number, order.order_number),
        });

        if (existing) {
            continue;
        }

        await dbClient.insert(orders).values(order);
        inserted += 1;
    }

    console.log(`Orders seeded (${inserted} new)`);
}

async function seedOrderItems() {
    const wantedOrderNumbers = ["ORD-2025001", "ORD-20250904", "ORD-20251001"];

    const ordersResult = await dbClient
        .select({
            id: orders.id,
            order_number: orders.order_number,
            total_amount: orders.total_amount,
        })
        .from(orders)
        .where(inArray(orders.order_number, wantedOrderNumbers));

    const orderIdByNumber = Object.fromEntries(
        ordersResult.map((order) => [order.order_number!, order.id]),
    );

    const missingOrders = wantedOrderNumbers.filter((orderNo) => !orderIdByNumber[orderNo]);
    if (missingOrders.length > 0) {
        throw new Error(`Missing orders for seeding order items: ${missingOrders.join(", ")}`);
    }

    const neededProductNames = [
        "Arabica Coffee Beans 1kg",
        "Cold Brew Concentrate 500ml",
        "Barista Oat Milk 1L",
        "Caramel Syrup 750ml",
        "Porcelain Espresso Cups (Set of 4)",
    ];

    const productsResult = await dbClient
        .select({
            id: products.id,
            name: products.name,
            sell: products.sell,
        })
        .from(products)
        .where(inArray(products.name, neededProductNames));

    const productIdByName = Object.fromEntries(
        productsResult.map((product) => [product.name!, product.id]),
    );
    const productPriceByName = Object.fromEntries(
        productsResult.map((product) => [product.name!, Number(product.sell ?? 0)]),
    );

    const missingProducts = neededProductNames.filter((productName) => !productIdByName[productName]);
    if (missingProducts.length > 0) {
        throw new Error(`Missing products for seeding order items: ${missingProducts.join(", ")}`);
    }

    const formatMoney = (value: number) => value.toFixed(2);

    const itemDefinitions = [
        { orderNumber: "ORD-2025001", productName: "Arabica Coffee Beans 1kg", quantity: 1 },
        { orderNumber: "ORD-2025001", productName: "Cold Brew Concentrate 500ml", quantity: 1 },
        { orderNumber: "ORD-2025001", productName: "Caramel Syrup 750ml", quantity: 1 },
        {
            orderNumber: "ORD-2025001",
            productName: "Porcelain Espresso Cups (Set of 4)",
            quantity: 1,
        },
        { orderNumber: "ORD-20250904", productName: "Caramel Syrup 750ml", quantity: 5 },
        { orderNumber: "ORD-20250904", productName: "Caramel Syrup 750ml", quantity: 5 },
        { orderNumber: "ORD-20251001", productName: "Cold Brew Concentrate 500ml", quantity: 3 },
        {
            orderNumber: "ORD-20251001",
            productName: "Porcelain Espresso Cups (Set of 4)",
            quantity: 1,
        },
        { orderNumber: "ORD-20251001", productName: "Caramel Syrup 750ml", quantity: 1 },
        { orderNumber: "ORD-20251001", productName: "Barista Oat Milk 1L", quantity: 1 },
    ];

    const orderItemsToSeed: OrderItemInsert[] = itemDefinitions.map(
        ({ orderNumber, productName, quantity }) => {
            const orderId = orderIdByNumber[orderNumber];
            const productId = productIdByName[productName];
            const unitPrice = productPriceByName[productName];

            if (orderId == null || productId == null || unitPrice == null) {
                throw new Error(
                    `Unable to resolve identifiers or price for order ${orderNumber} and product ${productName}`,
                );
            }

            const totalPrice = unitPrice * quantity;

            return {
                order_id: orderId,
                product_id: productId,
                quantity,
                unit_price: formatMoney(unitPrice),
                total_price: formatMoney(totalPrice),
            };
        },
    );

    const grouped = new Map<string, { row: OrderItemInsert; desiredCount: number }>();

    for (const row of orderItemsToSeed) {
        const key = `${row.order_id}|${row.product_id}|${row.quantity}|${row.unit_price}|${row.total_price}`;
        const existingEntry = grouped.get(key);

        if (existingEntry) {
            existingEntry.desiredCount += 1;
        } else {
            grouped.set(key, { row, desiredCount: 1 });
        }
    }

    let inserted = 0;

    for (const { row, desiredCount } of grouped.values()) {
        const { order_id, product_id, quantity, unit_price, total_price } = row;

        if (
            order_id == null ||
            product_id == null ||
            quantity == null ||
            unit_price == null ||
            total_price == null
        ) {
            throw new Error(
                `Seed order item missing required values (orderId=${order_id}, productId=${product_id})`,
            );
        }

        const existing = await dbClient.query.order_items.findMany({
            where: and(
                eq(order_items.order_id, order_id),
                eq(order_items.product_id, product_id),
                eq(order_items.quantity, quantity),
                eq(order_items.unit_price, unit_price),
                eq(order_items.total_price, total_price),
            ),
        });

        const missingCount = desiredCount - existing.length;

        if (missingCount <= 0) {
            continue;
        }

        const valuesToInsert = Array.from({ length: missingCount }, () => ({ ...row }));

        await dbClient.insert(order_items).values(valuesToInsert);
        inserted += missingCount;
    }

    console.log(`Order items seeded (${inserted} new)`);
}

async function seedStockIn() {
    const stockToSeed = [
        {
            product_id: 1,
            quantity: 200,
            received_date: new Date("2025-09-01T09:10:00Z"),
            supplier_id: 1,
            status: "received",
            note: "Monthly replenishment for espresso beans",
        },
        {
            product_id: 1,
            quantity: 150,
            received_date: new Date("2025-10-05T08:45:00Z"),
            supplier_id: 1,
            status: "received",
            note: "Top-up before promotional week",
        },
        {
            product_id: 2,
            quantity: 80,
            received_date: new Date("2025-09-10T10:30:00Z"),
            supplier_id: 2,
            status: "received",
            note: "Restock for iced menu",
        },
        {
            product_id: 2,
            quantity: 60,
            received_date: new Date("2025-10-03T14:20:00Z"),
            supplier_id: 2,
            status: "pending",
            note: "Awaiting QA check",
        },
        {
            product_id: 3,
            quantity: 200,
            received_date: new Date("2025-09-07T16:00:00Z"),
            supplier_id: 3,
            status: "received",
            note: "Dairy-free demand increasing",
        },
        {
            product_id: 3,
            quantity: 150,
            received_date: new Date("2025-10-09T11:40:00Z"),
            supplier_id: 3,
            status: "received",
            note: "Cafe bundle fulfillment",
        },
        {
            product_id: 4,
            quantity: 95,
            received_date: new Date("2025-09-18T15:05:00Z"),
            supplier_id: 4,
            status: "received",
            note: "Seasonal drinks restock",
        },
        {
            product_id: 4,
            quantity: 70,
            received_date: new Date("2025-10-12T13:25:00Z"),
            supplier_id: 4,
            status: "received",
            note: "Weekend event prep",
        },
        {
            product_id: 5,
            quantity: 40,
            received_date: new Date("2025-09-22T09:35:00Z"),
            supplier_id: 5,
            status: "received",
            note: "Breakage replacement & new set",
        },
        {
            product_id: 5,
            quantity: 20,
            received_date: new Date("2025-10-08T17:10:00Z"),
            supplier_id: 5,
            status: "received",
            note: "New staff training kit",
        },
    ];

    let inserted = 0;

    for (const stock of stockToSeed) {
        const existing = await dbClient.query.stock_in.findFirst({
            where: and(
                eq(stock_in.product_id, stock.product_id),
                eq(stock_in.received_date, stock.received_date),
            ),
        });

        if (existing) continue;

        await dbClient.insert(stock_in).values(stock);
        inserted += 1;
    }

    console.log(`Stock-in seeded (${inserted} new)`);
}

async function runSeed() {
    await seedEmployees();
    await seedProducts();
    await seedOrders();
    await seedOrderItems();
    await seedStockIn();
}

runSeed()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
