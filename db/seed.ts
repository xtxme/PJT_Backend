import { dbClient } from "@db/client.js";
import { employee } from "@db/schema.js";
import { v4 as uuidv4 } from "uuid";

async function seedEmployees() {
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
            password: "1234", // ❌ plain for testing only
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
            password: "1234",
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
            password: "1234",
        },
    ]);
    console.log("Employees seeded");
}

seedEmployees().then(() => process.exit(0));
