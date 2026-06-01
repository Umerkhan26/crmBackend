import { Request, Response, NextFunction } from "express";

/** List/view customers — any logged-in CRM user; data scoped in service layer. */
export const checkCustomerAccountReadAccess = (
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
  next();
};
