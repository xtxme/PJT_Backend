import { Router } from "express";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { dbClient } from "@db/client.js";

// คืน Router ที่มี CRUD ครบ (GET/POST/PATCH/DELETE)
export function makeCrudRouter(query: any, table: any) {
    const r = Router();

    r.get("/", async (_req, res, next) => {
        try {
            const results = await query.findMany();
            res.json(results);
        } catch (e) { next(e); }
    });

    r.post("/", async (req, res, next) => {
        try {
            const data = req.body;
            if (!data) throw new Error("Missing data");
            const id = uuidv4();
            await dbClient.insert(table).values({ ...data, id });
            const [row] = await dbClient.select().from(table).where(eq(table.id, id));
            res.status(201).json({ msg: `${table.name} inserted`, data: row });
        } catch (e) { next(e); }
    });

    r.patch("/", async (req, res, next) => {
        try {
            const { id, ...data } = req.body;
            if (!id) throw new Error("Missing id");
            await dbClient.update(table).set(data).where(eq(table.id, id));
            const [row] = await dbClient.select().from(table).where(eq(table.id, id));
            res.json({ msg: `${table.name} updated`, data: row });
        } catch (e) { next(e); }
    });

    r.delete("/", async (req, res, next) => {
        try {
            const { id } = req.body;
            if (!id) throw new Error("Missing id");
            await dbClient.delete(table).where(eq(table.id, id));
            res.json({ msg: `${table.name} deleted`, data: { id } });
        } catch (e) { next(e); }
    });

    r.delete("/all", async (_req, res, next) => {
        try {
            await dbClient.delete(table);
            res.json({ msg: `All ${table.name} deleted`, data: {} });
        } catch (e) { next(e); }
    });

    return r;
}
