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
        debugger
        // สร้าง URL ให้สะอาด: กัน "//"
        const redirect = normalizeRedirect(buildRedirectUrl(dbUser.role));

        // ✅ ส่ง role และ username กลับด้วย
        res.json({
            redirect,
            id: dbUser.id,
            role: dbUser.role,
            username: dbUser.username,
            name: `${dbUser.fname ?? ''} ${dbUser.lname ?? ''}`.trim(), // ✅ รวมชื่อ-นามสกุล
        });

        return;
    } catch (err) {
        next(err);
    }
};

// กัน redirect กลายเป็น "//owner"
function normalizeRedirect(url: string) {
    return url.replace(/([^:])\/{2,}/g, "$1/"); // ไม่แตะ "http://", แต่ลด '//' ส่วนอื่นให้เหลือ '/'
}

// GET /auth/google/callback
export const googleCallback: RequestHandler = async (req, res, next) => {
    try {
        const userEmail = (req.user as any)?.emails?.[0]?.value;
        if (!userEmail) return res.redirect(`${process.env.FRONTEND_URL}/unauthorized`);

        const dbUser: any = await dbClient.query.employee.findFirst({
            where: eq(employee.email, userEmail),
        });
        if (!dbUser) return res.redirect(`${process.env.FRONTEND_URL}/unauthorized`);

        // สร้างปลายทางตาม role
        const redirect = normalizeRedirect(buildRedirectUrl(dbUser.role));

        // ส่ง payload ผ่านหน้า bridge
        const bridge = new URL(`${process.env.FRONTEND_URL}/auth/bridge`);
        bridge.searchParams.set('redirect', redirect);
        bridge.searchParams.set('id', String(dbUser.id));
        bridge.searchParams.set('role', dbUser.role ?? '');
        bridge.searchParams.set('username', dbUser.username ?? '');
        bridge.searchParams.set('name', `${dbUser.fname ?? ''} ${dbUser.lname ?? ''}`.trim());

        return res.redirect(bridge.toString());
    } catch (err) {
        next(err);
    }
};

