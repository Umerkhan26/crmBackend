import { Request, Response } from "express";
import { CustomRequest } from "../types/custom";
import * as CustomerAreaService from "../services/customerArea.service";

export const resolveBrandController = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const host =
      (req.query.host as string) ||
      (req.headers["x-customer-host"] as string) ||
      "";
    const brand = await CustomerAreaService.resolveBrandByHost(host);
    if (!brand) {
      return res.status(404).json({
        success: false,
        message: "Brand not found for this host",
      });
    }
    return res.status(200).json({
      success: true,
      data: {
        id: brand.id,
        name: brand.name,
        slug: brand.slug,
        subdomain: brand.subdomain,
        customerPortalUrl: brand.customerPortalUrl,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const customerLoginController = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const { email, password, brandId } = req.body;
    const host =
      (req.body.host as string) ||
      (req.headers["x-customer-host"] as string) ||
      "";

    const result = await CustomerAreaService.customerLogin({
      email,
      password,
      brandId: brandId ? Number(brandId) : undefined,
      host,
    });

    return res.status(200).json({
      success: true,
      message: "Login successful",
      ...result,
    });
  } catch (error: any) {
    return res.status(401).json({ success: false, message: error.message });
  }
};

export const customerProfileController = async (
  req: CustomRequest,
  res: Response
): Promise<any> => {
  try {
    const profile = await CustomerAreaService.getCustomerProfile(req.user!.id);
    return res.status(200).json({ success: true, data: profile });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const customerSalesController = async (
  req: CustomRequest,
  res: Response
): Promise<any> => {
  try {
    const data = await CustomerAreaService.getCustomerSaleSummary(req.user!.id);
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
