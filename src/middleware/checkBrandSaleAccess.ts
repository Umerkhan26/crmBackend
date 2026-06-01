import { Request, Response, NextFunction } from "express";
import { canPerformBrandSale } from "../utils/brandPortalAccess";

/** Allows brand sale APIs for any authenticated user (agents, managers, admin). */
export const checkBrandSaleAccess = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  if (!req.user?.id) {
    res.status(403).json({
      message: "Forbidden: You lack permission to perform this action.",
    });
    return;
  }

  if (!canPerformBrandSale(req.user.permissions || [])) {
    res.status(403).json({
      message: "Forbidden: You lack permission to perform this action.",
    });
    return;
  }

  next();
};
