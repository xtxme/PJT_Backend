import { Router } from "express";
import passport from "passport";
import { login, googleCallback } from "../controllers/auth.controller.js";

const router = Router();

// email+password
router.post("/auth/login", login);

// Google OAuth
router.get("/auth/google",
    passport.authenticate("google", { scope: ["profile", "email"] })
);

router.get(
    "/auth/google/callback",
    passport.authenticate("google", { failureRedirect: "/login" }),
    googleCallback
);

export default router;
