import { Router } from "express";
import { listProducts, updateProductPrice } from "../controllers/owner-products.controller.js";

const router = Router();

// GET /inventory/products?q=keyword
router.get("/owner-products", listProducts);
// PATCH /inventory/owner-products/:productId/price
router.patch("/owner-products/:productId/price", updateProductPrice);

export default router;
