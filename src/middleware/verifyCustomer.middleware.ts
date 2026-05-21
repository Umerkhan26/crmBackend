import { Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { extractUserIdFromToken } from "../utils/authHelper";
import { CustomRequest } from "../types/custom";
import User from "../models/user.model";
import {
  readPortalHostFromRequest,
  resolvePortalBrand,
} from "../utils/portalHost";

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

    let brandId: number | undefined;
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as {
        brandId?: number;
      };
      if (decoded?.brandId) brandId = Number(decoded.brandId);
    } catch {
      /* ignore */
    }
    if (!brandId) {
      const hostInput = readPortalHostFromRequest(req);
      const brand = await resolvePortalBrand(hostInput);
      brandId = brand?.id;
    }
    if (brandId) {
      (req as any).portalBrandId = brandId;
    }

    next();
  } catch {
    res.status(500).json({ message: "Server error" });
  }
};
