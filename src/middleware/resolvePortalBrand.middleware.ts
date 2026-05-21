import { Response, NextFunction } from "express";
import { CustomRequest } from "../types/custom.d";
import {
  readPortalHostFromRequest,
  resolvePortalBrand,
} from "../utils/portalHost";
import { extractBrandIdFromCustomerToken } from "../services/customerPortal.service";

/** Attach portalBrandId on request (public routes + optional on authed). */
export const attachPortalBrand = async (
  req: CustomRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const input = readPortalHostFromRequest(req);
    const token = req.headers.authorization?.split(" ")[1];
    if (token) {
      const fromJwt = extractBrandIdFromCustomerToken(token);
      if (fromJwt) input.brandId = fromJwt;
    }
    const brand = await resolvePortalBrand(input);
    if (brand) {
      (req as any).portalBrandId = brand.id;
      (req as any).portalBrand = brand;
    }
    next();
  } catch {
    next();
  }
};

export const requirePortalBrand = (
  req: CustomRequest,
  res: Response,
  next: NextFunction
): void => {
  const brandId = (req as any).portalBrandId as number | undefined;
  if (!brandId) {
    res.status(400).json({
      success: false,
      message:
        "Brand could not be resolved. Use ?brandSlug=emrills, ?brandId=1, header x-customer-host, or CUSTOMER_PORTAL_LOCAL_BRAND_SLUG in .env",
    });
    return;
  }
  next();
};
