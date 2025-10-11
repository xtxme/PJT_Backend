import { Router } from "express";
import authRoutes from "./auth.routes.js";
import crudRoutes from "./crud.routes.js";

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

export default router;
