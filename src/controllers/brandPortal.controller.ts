import { Request, Response } from "express";
import * as CustomerAreaService from "../services/customerArea.service";
import {
  canAccessBrandSalesForm,
  getPortalBrandsForUser,
} from "../utils/brandPortalAccess";

export const getPortalBrandsController = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const permissions: string[] = (req as any).user?.permissions || [];
    const brands = await getPortalBrandsForUser(userId, permissions);

    return res.status(200).json({
      success: true,
      message: "Portal brands fetched",
      data: brands,
      meta: {
        scope: "all",
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getBrandSalesFormController = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const brandId = parseInt(req.params.brandId, 10);
    if (isNaN(brandId)) {
      return res.status(400).json({ success: false, message: "Invalid brand ID" });
    }

    const permissions: string[] = (req as any).user?.permissions || [];
    const allowed = await canAccessBrandSalesForm(userId, brandId, permissions);
    if (!allowed) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this brand",
      });
    }

    const brand = await CustomerAreaService.getBrandSalesForm(brandId);
    return res.status(200).json({
      success: true,
      message: "Sales form config fetched",
      data: brand,
    });
  } catch (error: any) {
    const status = error.message === "Brand not found" ? 404 : 500;
    return res.status(status).json({ success: false, message: error.message });
  }
};
