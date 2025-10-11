import { Router } from "express";
import userController from "../controllers/user.controller.js";

const router = Router();

router.use("/users", userController);

export default router;
