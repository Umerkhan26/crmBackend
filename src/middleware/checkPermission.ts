import { Request, Response, NextFunction } from "express";
import { PERMISSIONS } from "../constants/permissions";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        permissions: string[];

      };
    }
  }
}

export const checkPermission = (requiredPermission: string | string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res
        .status(403)
        .json({
          message: "Forbidden: You lack permission to perform this action.",
        });
      return;
    }

    // If array of permissions provided, check if user has at least one
    if (Array.isArray(requiredPermission)) {
      const hasPermission = requiredPermission.some(permission => 
        req.user!.permissions.includes(permission)
      );
      if (!hasPermission) {
        res
          .status(403)
          .json({
            message: "Forbidden: You lack permission to perform this action.",
          });
        return;
      }
    } else {
      // Single permission check
      if (!req.user.permissions.includes(requiredPermission)) {
        res
          .status(403)
          .json({
            message: "Forbidden: You lack permission to perform this action.",
          });
        return;
      }
    }

    next();
  };
};
