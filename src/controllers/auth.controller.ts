import type { RequestHandler } from "express";
import passport from "passport";
import { getUserByEmail, verifyPassword, buildRedirectUrl } from "../services/auth.service.js";
import { employee } from "@db/schema.js";
import { eq } from "drizzle-orm";
import { dbClient } from "@db/client.js";

// POST /auth/login
export const login: RequestHandler = async (req, res, next) => {
    try {
        const { email, password } = req.body as { email: string; password: string };
        const dbUser: any = await getUserByEmail(email);
        if (!dbUser) return res.status(401).json({ error: "Invalid credentials" });

        const ok = await verifyPassword(password, dbUser.password);
        if (!ok) return res.status(401).json({ error: "Invalid credentials" });

        res.json({ redirect: buildRedirectUrl(dbUser.role) });
    } catch (err) { next(err); }
};

// GET /auth/google/callback (หลังผ่าน passport.authenticate)
export const googleCallback: RequestHandler = async (req, res, next) => {
    try {
        const userEmail = (req.user as any).emails[0].value;
        const dbUser: any = await dbClient.query.employee.findFirst({
            where: eq(employee.email, userEmail),
        });

        if (!dbUser) return res.redirect(`${process.env.FRONTEND_URL}/unauthorized`);
        return res.redirect(buildRedirectUrl(dbUser.role));
    } catch (err) { next(err); }
};
