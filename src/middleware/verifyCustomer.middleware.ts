import { Response, NextFunction } from "express";
import { extractUserIdFromToken } from "../utils/authHelper";
import { CustomRequest } from "../types/custom";
import User from "../models/user.model";

export const verifyCustomerToken = async (
  req: CustomRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    res.status(403).json({ message: "No token provided" });
    return;
  }

  const userId = extractUserIdFromToken(token);
  if (!userId) {
    res.status(401).json({ message: "Invalid or expired token" });
    return;
  }

  try {
    const user = await User.findByPk(userId);
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    const role = (user.userrole || "").toLowerCase();
    if (role !== "customer" && role !== "client") {
      res.status(403).json({ message: "Customer access only" });
      return;
    }

    req.user = { id: user.id!, permissions: [] };
    (req as any).customerUser = user;
    next();
  } catch {
    res.status(500).json({ message: "Server error" });
  }
};
