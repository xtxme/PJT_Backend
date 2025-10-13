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

    // สร้าง URL ให้สะอาด: กัน "//"
    const redirect = normalizeRedirect(buildRedirectUrl(dbUser.role));

    // ✅ ส่ง role และ username กลับด้วย
    res.json({ redirect, role: dbUser.role, username: dbUser.username });
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
