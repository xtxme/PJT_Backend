import { Request, Response, NextFunction, RequestHandler } from "express";

/**
 * Wrapper สำหรับ async route handler เพื่อให้ TypeScript รู้ว่า return เป็น void เสมอ
 */
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
