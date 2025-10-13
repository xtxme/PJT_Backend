import { Router } from "express";
import authRoutes from "./auth.routes.js";
import crudRoutes from "./crud.routes.js";
import analyticsRoutes from "./analytics.routes.js";
import userRoutes from "./user.routes.js";
import saleRoutes from "../controllers/sale.controller.js";
import ownerRoutes from "../controllers/owner.controller.js";
import warehouseRoutes from "../controllers/warehouse.controller.js";
import inventoryRoutes from "./inventory.routes.js";

const router = Router();

// demo owner
router.get("/owner", (_req, res) => {
    res.json({
        id: "660610757",
        name: "Natrada Nuchit",
        course_id: "269497",
        section: "001",
    });
});

// auth + crud
router.use(authRoutes);
router.use(crudRoutes);
router.use(analyticsRoutes);
router.use("/owner", ownerRoutes);
router.use("/sale", saleRoutes);
router.use("/warehouse", warehouseRoutes);
router.use("/role-access", userRoutes);
router.use("/inventory", inventoryRoutes);
export default router;
