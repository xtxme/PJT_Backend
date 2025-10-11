import { Router } from "express";
import bcrypt from "bcrypt";
import { desc, eq } from "drizzle-orm";
import { dbClient } from "@db/client.js";
import { employee } from "@db/schema.js";

const router = Router();

const roleAccessSelect = {
  id: employee.id,
  fname: employee.fname,
  lname: employee.lname,
  username: employee.username,
  email: employee.email,
  tel: employee.tel,
  role: employee.role,
  status: employee.status,
  createdAt: employee.created_at,
  updatedAt: employee.updated_at,
};

router.get("/", async (_req, res, next) => {
  try {
    const users = await dbClient
      .select(roleAccessSelect)
      .from(employee)
      .orderBy(desc(employee.created_at));

    res.json(users);
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const {
      fname,
      lname,
      username,
      email,
      tel,
      role,
      status = "Active",
      password,
    } = req.body ?? {};

    if (!fname || !lname || !username || !email || !role || !password) {
      res.status(400).json({ message: "Missing required fields" });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await dbClient.insert(employee).values({
      fname,
      lname,
      username,
      email,
      tel,
      role,
      status,
      password: hashedPassword,
    });

    const [createdUser] = await dbClient
      .select(roleAccessSelect)
      .from(employee)
      .where(eq(employee.email, email))
      .limit(1);

    res.status(201).json(createdUser);
  } catch (error) {
    next(error);
  }
});

router.patch("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const numericId = Number(id);

    if (!id || Number.isNaN(numericId)) {
      res.status(400).json({ message: "Invalid user id" });
      return;
    }

    const {
      fname,
      lname,
      username,
      email,
      tel,
      role,
      status,
      password,
    } = req.body ?? {};

    const updatePayload: Record<string, unknown> = {};

    if (typeof fname !== "undefined") updatePayload.fname = fname;
    if (typeof lname !== "undefined") updatePayload.lname = lname;
    if (typeof username !== "undefined") updatePayload.username = username;
    if (typeof email !== "undefined") updatePayload.email = email;
    if (typeof tel !== "undefined") updatePayload.tel = tel;
    if (typeof role !== "undefined") updatePayload.role = role;
    if (typeof status !== "undefined") updatePayload.status = status;

    if (typeof password === "string" && password.trim().length > 0) {
      updatePayload.password = await bcrypt.hash(password, 10);
    }

    if (Object.keys(updatePayload).length === 0) {
      res.status(400).json({ message: "No fields provided for update" });
      return;
    }

    await dbClient.update(employee).set(updatePayload).where(eq(employee.id, numericId));

    const [updatedUser] = await dbClient
      .select(roleAccessSelect)
      .from(employee)
      .where(eq(employee.id, numericId))
      .limit(1);

    res.json(updatedUser);
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const numericId = Number(id);

    if (!id || Number.isNaN(numericId)) {
      res.status(400).json({ message: "Invalid user id" });
      return;
    }

    await dbClient.delete(employee).where(eq(employee.id, numericId));

    res.json({ success: true, id: numericId });
  } catch (error) {
    next(error);
  }
});

export default router;
