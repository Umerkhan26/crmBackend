import { Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { CustomRequest } from "../types/custom";
import PortalCustomer from "../models/portalCustomer.model";
import {
  decodePortalCustomerToken,
  PORTAL_CUSTOMER_TOKEN_TYPE,
} from "../utils/portalCustomerToken";
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

  const payload = decodePortalCustomerToken(token);
  if (!payload?.id) {
    res.status(401).json({ message: "Invalid or expired token" });
    return;
  }

  try {
    const portalCustomer = await PortalCustomer.findByPk(payload.id);
    if (!portalCustomer || portalCustomer.status !== "active") {
      res.status(404).json({ message: "Customer not found" });
      return;
    }

    req.user = { id: portalCustomer.id!, permissions: [] };
    (req as any).portalCustomer = portalCustomer;
    (req as any).customerUser = portalCustomer;

    let brandId: number | undefined = payload.brandId;
    if (!brandId) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as {
          brandId?: number;
          tokenType?: string;
        };
        if (decoded?.tokenType === PORTAL_CUSTOMER_TOKEN_TYPE && decoded.brandId) {
          brandId = Number(decoded.brandId);
        }
      } catch {
        /* ignore */
      }
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
