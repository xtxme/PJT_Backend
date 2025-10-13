import { Router } from "express";
import { listProducts } from "../controllers/owner-products.controller.js";


const router = Router();

// GET /inventory/products?q=keyword
router.get("/owner-products", listProducts);

export default router;
