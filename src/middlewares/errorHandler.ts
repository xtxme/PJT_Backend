import type { Request, Response, NextFunction } from "express";

export const notFound = (_req: Request, res: Response) => {
    res.status(404).json({ message: "Not found" });
};

export const errorHandler = (err: any, _req: Request, res: Response, _next: NextFunction) => {
    const code = err.status || 500;
    res.status(code).json({
        message: err.message || "Internal Server Error",
        type: err.name || "Error",
        stack: process.env.NODE_ENV === "production" ? undefined : err.stack,
    });
};
