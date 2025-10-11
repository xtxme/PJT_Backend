import { Router } from "express";
import analyticsController from "../controllers/analytics.controller.js";

const router = Router();

router.use("/analytics", analyticsController);

export default router;
