import { dbClient } from "@db/client.js";
import { employee } from "@db/schema.js";
import bcrypt from "bcrypt";

async function seedEmployees() {
    const hashedPassword = await bcrypt.hash("1234", 10); // same for all demo users

    await dbClient.insert(employee).values([
        {
            id: 1,
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
            id: 2,
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
            id: 3,
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

seedEmployees().then(() => process.exit(0));
