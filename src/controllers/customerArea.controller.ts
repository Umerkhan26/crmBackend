import { Request, Response } from "express";
import { CustomRequest } from "../types/custom";
import * as CustomerAreaService from "../services/customerArea.service";
import * as CustomerPortalService from "../services/customerPortal.service";
import * as PortalServicePortal from "../services/portalServicePortal.service";
import { readPortalHostFromRequest } from "../utils/portalHost";

const portalBrandId = (req: CustomRequest): number => {
  const id = (req as any).portalBrandId;
  if (!id) throw new Error("Brand not resolved on request");
  return id;
};

export const resolveBrandController = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const input = readPortalHostFromRequest(req);
    const data = await CustomerPortalService.resolveBrandForPortalRequest(
      input
    );
    if (!data) {
      return res.status(404).json({
        success: false,
        message: "Brand not found for this host",
      });
    }
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const brandConfigController = async (
  req: Request,
  res: Response
): Promise<any> => {
  return resolveBrandController(req, res);
};

export const customerLoginController = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const { email, password, brandId, brandSlug: bodySlug } = req.body;
    const hostInput = readPortalHostFromRequest(req);
    const brandSlug =
      hostInput.brandSlug ||
      (bodySlug ? String(bodySlug).trim() : undefined);

    const result = await CustomerAreaService.customerLogin({
      email,
      password,
      brandId: brandId ? Number(brandId) : hostInput.brandId,
      host: hostInput.host,
      brandSlug,
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
    const portalBrandId = (req as { portalBrandId?: number }).portalBrandId;
    const profile = await CustomerAreaService.getCustomerProfile(
      req.user!.id,
      portalBrandId
    );
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

export const customerOrdersController = async (
  req: CustomRequest,
  res: Response
): Promise<any> => {
  try {
    const brandId = portalBrandId(req);
    const data = await CustomerPortalService.listCustomerOrders(
      req.user!.id,
      brandId
    );
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    const status = /not found|no customer/i.test(error.message) ? 404 : 500;
    return res.status(status).json({ success: false, message: error.message });
  }
};

export const customerOrderProgressController = async (
  req: CustomRequest,
  res: Response
): Promise<any> => {
  try {
    const saleId = parseInt(req.params.saleId, 10);
    if (isNaN(saleId)) {
      return res.status(400).json({ success: false, message: "Invalid sale id" });
    }
    const data = await CustomerPortalService.getOrderProgress(
      req.user!.id,
      portalBrandId(req),
      saleId
    );
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    const status = /not found|not linked/i.test(error.message) ? 404 : 500;
    return res.status(status).json({ success: false, message: error.message });
  }
};

export const customerInvoicesController = async (
  req: CustomRequest,
  res: Response
): Promise<any> => {
  try {
    const data = await CustomerPortalService.listCustomerInvoices(
      req.user!.id,
      portalBrandId(req)
    );
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const customerOffersController = async (
  req: CustomRequest,
  res: Response
): Promise<any> => {
  try {
    const data = await CustomerPortalService.listCustomerOffers(
      req.user!.id,
      portalBrandId(req)
    );
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const customerAnnouncementsController = async (
  req: CustomRequest,
  res: Response
): Promise<any> => {
  try {
    const rows = await CustomerPortalService.listCustomerAnnouncements(
      req.user!.id,
      portalBrandId(req)
    );
    return res.status(200).json({ success: true, data: rows });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const customerPopupsController = async (
  req: CustomRequest,
  res: Response
): Promise<any> => {
  try {
    const data = await CustomerPortalService.listCustomerPopups(
      req.user!.id,
      portalBrandId(req)
    );
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const dismissPopupController = async (
  req: CustomRequest,
  res: Response
): Promise<any> => {
  try {
    const popupId = parseInt(req.params.popupId, 10);
    if (isNaN(popupId)) {
      return res.status(400).json({ success: false, message: "Invalid popup id" });
    }
    const data = await CustomerPortalService.dismissCustomerPopup(
      req.user!.id,
      portalBrandId(req),
      popupId
    );
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const customerNotificationsController = async (
  req: CustomRequest,
  res: Response
): Promise<any> => {
  try {
    const data = await CustomerPortalService.listCustomerNotifications(
      req.user!.id,
      portalBrandId(req)
    );
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const customerStatsController = async (
  req: CustomRequest,
  res: Response
): Promise<any> => {
  try {
    const data = await CustomerPortalService.getCustomerDashboardStats(
      req.user!.id,
      portalBrandId(req)
    );
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    const status = /not found|no customer/i.test(error.message) ? 404 : 500;
    return res.status(status).json({ success: false, message: error.message });
  }
};

export const trackPortalActivityController = async (
  req: CustomRequest,
  res: Response
): Promise<any> => {
  try {
    const { action, title, metadata } = req.body || {};
    if (!action) {
      return res.status(400).json({ success: false, message: "action is required" });
    }
    const data = await CustomerPortalService.trackCustomerPortalActivity(
      req.user!.id,
      portalBrandId(req),
      { action, title, metadata }
    );
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    const status = /invalid activity/i.test(error.message) ? 400 : 500;
    return res.status(status).json({ success: false, message: error.message });
  }
};

export const customerServicesController = async (
  req: CustomRequest,
  res: Response
): Promise<any> => {
  try {
    const data = await PortalServicePortal.listCustomerPortalServices(
      req.user!.id,
      portalBrandId(req)
    );
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    const status = /not found|no customer/i.test(error.message) ? 404 : 500;
    return res.status(status).json({ success: false, message: error.message });
  }
};

export const customerServiceDetailController = async (
  req: CustomRequest,
  res: Response
): Promise<any> => {
  try {
    const slug = String(req.params.slug || "").trim();
    if (!slug) {
      return res.status(400).json({ success: false, message: "Invalid service slug" });
    }
    const data = await PortalServicePortal.getCustomerPortalServiceBySlug(
      req.user!.id,
      portalBrandId(req),
      slug
    );
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    const status = /not found/i.test(error.message) ? 404 : 500;
    return res.status(status).json({ success: false, message: error.message });
  }
};

export const submitCustomerServiceFormController = async (
  req: CustomRequest,
  res: Response
): Promise<any> => {
  try {
    const slug = String(req.params.slug || "").trim();
    if (!slug) {
      return res.status(400).json({ success: false, message: "Invalid service slug" });
    }
    const data = await PortalServicePortal.submitCustomerPortalServiceForm(
      req.user!.id,
      portalBrandId(req),
      slug,
      req.body?.formData || req.body || {}
    );
    return res.status(201).json({
      success: true,
      message: "Form submitted successfully",
      data,
    });
  } catch (error: any) {
    const status = /not found|no form|required|valid|invalid/i.test(error.message)
      ? 400
      : 500;
    return res.status(status).json({ success: false, message: error.message });
  }
};
