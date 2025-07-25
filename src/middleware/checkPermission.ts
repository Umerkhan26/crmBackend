// middleware/checkPermission.ts
import { Request, Response, NextFunction } from "express";
import { PERMISSIONS } from "../constants/permissions";

// Extend request to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        permissions: string[];
        // other fields if needed
      };
    }
  }
}

export const checkPermission = (requiredPermission: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !req.user.permissions.includes(requiredPermission)) {
      res
        .status(403)
        .json({
          message: "Forbidden: You lack permission to perform this action.",
        });
      return; // Add explicit return to exit early
    }

    next(); // no return value, just continue
  };
};
