import { Response, NextFunction } from "express";
import { extractUserIdFromToken } from "../utils/authHelper";
import { CustomRequest } from "../types/custom";
import User from "../models/user.model";
import Role from "../models/role.model";
import Permission from "../models/permission.model";

export const verifyToken = async (req: CustomRequest, res: Response, next: NextFunction): Promise<void> => {
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
    const user = await User.findByPk(userId, {
      include: {
        model: Role,
        include: [Permission],
      },
    }) as any;

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    const permissions = user.Role?.Permissions?.map((p: any) => p.name) || [];

    req.user = {
      id: user.id!,
      permissions,
    };

    next();
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};
