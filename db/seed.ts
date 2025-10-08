import { dbClient } from "@db/client.js";
import { employee } from "@db/schema.js";
import bcrypt from "bcrypt";
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

async function runSeed() {
    await seedEmployees();
    await seedProducts();
}

runSeed()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
