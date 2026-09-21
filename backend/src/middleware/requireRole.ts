import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "./authenticate";

export function requireRole(...allowedRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: { code: "NOT_AUTHENTICATED", message: "You must be logged in." },
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: { code: "FORBIDDEN", message: "You do not have access to this resource." },
      });
    }

    next();
  };
}
