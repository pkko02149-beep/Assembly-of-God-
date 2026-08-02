import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "./jwt";

export function requireAuth(...roles: Array<"admin" | "teacher" | "parent">) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization;
      const cookieToken = (req as any).cookies?.token;
      const token = authHeader?.startsWith("Bearer ")
        ? authHeader.slice(7)
        : cookieToken;

      if (!token) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const payload = verifyToken(token);
      if (roles.length > 0 && !roles.includes(payload.role)) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }

      (req as any).user = payload;
      next();
    } catch {
      res.status(401).json({ error: "Invalid token" });
    }
  };
}
