import { Request, Response } from "express";
import * as CustomerAreaService from "../services/customerArea.service";

export const getPortalBrandsController = async (
  _req: Request,
  res: Response
): Promise<any> => {
  try {
    const brands = await CustomerAreaService.getPortalBrands();
    return res.status(200).json({
      success: true,
      message: "Portal brands fetched",
      data: brands,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getBrandSalesFormController = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const brandId = parseInt(req.params.brandId, 10);
    if (isNaN(brandId)) {
      return res.status(400).json({ success: false, message: "Invalid brand ID" });
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
