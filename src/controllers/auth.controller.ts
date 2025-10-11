// src/controllers/auth.controller.ts
import type { RequestHandler } from "express";
import { getUserByEmail, verifyPassword, buildRedirectUrl } from "../services/auth.service.js";
import { employee } from "@db/schema.js";
import { eq } from "drizzle-orm";
import { dbClient } from "@db/client.js";

// POST /auth/login
export const login: RequestHandler = async (req, res, next): Promise<void> => {
    try {
        const { email, password } = req.body as { email: string; password: string };

        const dbUser: any = await getUserByEmail(email);
        if (!dbUser) {
            res.status(401).json({ error: "Invalid credentials" });
            return;
        }

        const ok = await verifyPassword(password, dbUser.password);
        if (!ok) {
            res.status(401).json({ error: "Invalid credentials" });
            return;
        }

        res.json({ redirect: buildRedirectUrl(dbUser.role) });
        return;
    } catch (err) {
        next(err);
    }
};

// GET /auth/google/callback
export const googleCallback: RequestHandler = async (req, res, next): Promise<void> => {
    try {
        const userEmail = (req.user as any).emails[0].value;
        const dbUser: any = await dbClient.query.employee.findFirst({
            where: eq(employee.email, userEmail),
        });

        if (!dbUser) {
            res.redirect(`${process.env.FRONTEND_URL}/unauthorized`);
            return;
        }

        res.redirect(buildRedirectUrl(dbUser.role));
        return;
    } catch (err) {
        next(err);
    }
};
