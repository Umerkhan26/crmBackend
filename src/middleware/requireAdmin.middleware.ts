import { Response, NextFunction } from "express";
import { CustomRequest } from "../types/custom";
import User from "../models/user.model";
import Role from "../models/role.model";

/**
 * Must run after verifyToken. Allows only users whose role name is admin / adminn.
 */
export const requireAdmin = async (
  req: CustomRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ success: false, message: "User not authenticated" });
    return;
  }

  try {
    const user = (await User.findByPk(userId, {
      include: [{ model: Role, as: "role" }],
    })) as any;

    if (!user) {
      res.status(404).json({ success: false, message: "User not found" });
      return;
    }

    const roleName = (user.role?.name || "").toLowerCase().trim();
    if (roleName !== "admin" && roleName !== "adminn") {
      res.status(403).json({ success: false, message: "Admin access required" });
      return;
    }

    next();
  } catch {
    res.status(500).json({ success: false, message: "Server error" });
  }
};
