import bcrypt from "bcrypt";
import { dbClient } from "@db/client.js";
import { employee } from "@db/schema.js";
import { eq } from "drizzle-orm";

export const getUserByEmail = (email: string) =>
    dbClient.query.employee.findFirst({ where: eq(employee.email, email) });

export const verifyPassword = (plain: string, hash: string) =>
    bcrypt.compare(plain, hash);

export const buildRedirectUrl = (role: string) =>
    `${process.env.FRONTEND_URL}/${role}`;
