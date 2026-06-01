import { Response } from "express";
import { CustomRequest } from "../types/custom";
import * as CustomerAccountService from "../services/customerAccount.service";
import {
  getCustomerAccountInsights,
  getCustomerEngagementsFeed,
  getCustomerTimelineFeed,
} from "../services/customerAccountInsights.service";
import * as CustomerEngagementService from "../services/customerEngagement.service";

export const listCustomerAccountsController = async (
  req: CustomRequest,
  res: Response
): Promise<any> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = (req.query.search as string) || "";
    const brandId = req.query.brandId
      ? parseInt(req.query.brandId as string)
      : undefined;

    const userId = req.user?.id;
    const permissions = req.user?.permissions || [];

    const data = await CustomerAccountService.listCustomerAccounts({
      page,
      limit,
      search,
      brandId,
      viewerUserId: userId,
      viewerPermissions: permissions,
    });

    return res.status(200).json({
      success: true,
      message: "Customer accounts fetched",
      ...data,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getCustomerAccountByIdController = async (
  req: CustomRequest,
  res: Response
): Promise<any> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, message: "Invalid ID" });
    }
    const account = await CustomerAccountService.getCustomerAccountById(
      id,
      req.user?.id,
      req.user?.permissions || [],
    );
    return res.status(200).json({ success: true, data: account });
  } catch (error: any) {
    const msg = error.message || "Failed to load customer";
    const status =
      msg.includes("not found") || /do not have access/i.test(msg) ? 404 : 500;
    return res.status(status).json({ success: false, message: msg });
  }
};

export const getCustomerAccountInsightsController = async (
  req: CustomRequest,
  res: Response
): Promise<any> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, message: "Invalid ID" });
    }
    await CustomerAccountService.getCustomerAccountById(
      id,
      req.user?.id,
      req.user?.permissions || [],
    );
    const parseIntQ = (v: unknown, fallback: number) => {
      const n = parseInt(String(v || ""), 10);
      return Number.isNaN(n) ? fallback : n;
    };
    const data = await getCustomerAccountInsights(id, {
      emailsPage: parseIntQ(req.query.emailsPage, 1),
      emailsLimit: parseIntQ(req.query.emailsLimit, 30),
      engagementsPage: parseIntQ(req.query.engagementsPage, 1),
      engagementsLimit: parseIntQ(req.query.engagementsLimit, 30),
      timelinePage: parseIntQ(req.query.timelinePage, 1),
      timelineLimit: parseIntQ(req.query.timelineLimit, 30),
      activitiesPage: parseIntQ(req.query.activitiesPage, 1),
      activitiesLimit: parseIntQ(req.query.activitiesLimit, 30),
    });
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    const msg = error?.message || "Failed to load customer insights";
    const status =
      /not found/i.test(msg) || /do not have access/i.test(msg) ? 404 : 500;
    return res.status(status).json({ success: false, message: msg });
  }
};

const parsePageLimit = (req: CustomRequest, defaultLimit = 30) => {
  const parseIntQ = (v: unknown, fallback: number) => {
    const n = parseInt(String(v || ""), 10);
    return Number.isNaN(n) ? fallback : n;
  };
  return {
    page: parseIntQ(req.query.page, 1),
    limit: parseIntQ(req.query.limit, defaultLimit),
  };
};

export const getCustomerEngagementsFeedController = async (
  req: CustomRequest,
  res: Response
): Promise<any> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, message: "Invalid ID" });
    }
    await CustomerAccountService.getCustomerAccountById(
      id,
      req.user?.id,
      req.user?.permissions || [],
    );
    const { page, limit } = parsePageLimit(req, 30);
    const data = await getCustomerEngagementsFeed(id, page, limit);
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    const msg = error?.message || "Failed to load engagements";
    const status =
      /not found/i.test(msg) || /do not have access/i.test(msg) ? 404 : 500;
    return res.status(status).json({ success: false, message: msg });
  }
};

export const getCustomerTimelineFeedController = async (
  req: CustomRequest,
  res: Response
): Promise<any> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, message: "Invalid ID" });
    }
    const { page, limit } = parsePageLimit(req, 30);
    const data = await getCustomerTimelineFeed(id, page, limit);
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    const msg = error?.message || "Failed to load timeline";
    const status =
      /not found/i.test(msg) || /do not have access/i.test(msg) ? 404 : 500;
    return res.status(status).json({ success: false, message: msg });
  }
};

const parseAccountId = (req: CustomRequest) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) throw new Error("Invalid customer account ID");
  return id;
};

export const updateCustomerAccountController = async (
  req: CustomRequest,
  res: Response
): Promise<any> => {
  try {
    const id = parseAccountId(req);
    const body = req.body || {};
    const data = await CustomerAccountService.updateCustomerAccount(id, {
      status: body.status,
      firstname: body.firstname,
      lastname: body.lastname,
      email: body.email,
      phone: body.phone,
      brandId: body.brandId,
      leadStatus: body.leadStatus,
      businessName: body.businessName,
      saleStatus: body.saleStatus,
      saleNotes: body.saleNotes,
      productType: body.productType,
      salePrice: body.salePrice,
      products: body.products,
    });
    return res.status(200).json({ success: true, data, message: "Customer updated" });
  } catch (error: any) {
    const msg = error?.message || "Failed to update customer";
    const status = /not found/i.test(msg) ? 404 : 400;
    return res.status(status).json({ success: false, message: msg });
  }
};

export const deleteCustomerAccountController = async (
  req: CustomRequest,
  res: Response
): Promise<any> => {
  try {
    const id = parseAccountId(req);
    const data = await CustomerAccountService.deleteCustomerAccount(id);
    return res.status(200).json({ success: true, data, message: "Customer account removed" });
  } catch (error: any) {
    const msg = error?.message || "Failed to delete customer";
    const status = /not found/i.test(msg) ? 404 : 500;
    return res.status(status).json({ success: false, message: msg });
  }
};

export const sendCustomerEmailController = async (
  req: CustomRequest,
  res: Response
): Promise<any> => {
  try {
    const accountId = parseAccountId(req);
    const { subject, body, category } = req.body;
    if (!subject?.trim() || !body?.trim()) {
      return res.status(400).json({ success: false, message: "Subject and body required" });
    }
    const data = await CustomerEngagementService.sendEmailToCustomerAccount({
      accountId,
      subject: subject.trim(),
      body: body.trim(),
      category: category || "promotional",
      createdBy: req.user!.id,
    });
    return res.status(200).json({ success: true, message: "Email sent", data });
  } catch (error: any) {
    const status = /not found/i.test(error.message) ? 404 : 500;
    return res.status(status).json({ success: false, message: error.message });
  }
};

export const applyCustomerDiscountController = async (
  req: CustomRequest,
  res: Response
): Promise<any> => {
  try {
    const accountId = parseAccountId(req);
    const data = await CustomerEngagementService.applyCustomerDiscount({
      accountId,
      discountPercent: req.body.discountPercent,
      discountCode: req.body.discountCode,
      note: req.body.note,
      validUntil: req.body.validUntil,
      createdBy: req.user!.id,
    });
    return res.status(200).json({ success: true, message: "Discount applied", data });
  } catch (error: any) {
    const status = /not found/i.test(error.message) ? 404 : 500;
    return res.status(status).json({ success: false, message: error.message });
  }
};

export const createCustomerUpsellController = async (
  req: CustomRequest,
  res: Response
): Promise<any> => {
  try {
    const accountId = parseAccountId(req);
    const { productName, price, description } = req.body;
    if (!productName?.trim()) {
      return res.status(400).json({ success: false, message: "Product name required" });
    }
    const data = await CustomerEngagementService.createUpsellOffer({
      accountId,
      productName: productName.trim(),
      price,
      description,
      createdBy: req.user!.id,
    });
    return res.status(200).json({ success: true, message: "Upsell offer created", data });
  } catch (error: any) {
    const status = /not found/i.test(error.message) ? 404 : 500;
    return res.status(status).json({ success: false, message: error.message });
  }
};

export const sendCustomerNotificationController = async (
  req: CustomRequest,
  res: Response
): Promise<any> => {
  try {
    const accountId = parseAccountId(req);
    const { message, sendEmailAlso } = req.body;
    if (!message?.trim()) {
      return res.status(400).json({ success: false, message: "Message required" });
    }
    const data = await CustomerEngagementService.sendCustomerNotification({
      accountId,
      message: message.trim(),
      sendEmailAlso: !!sendEmailAlso,
      createdBy: req.user!.id,
    });
    return res.status(200).json({ success: true, message: "Notification sent", data });
  } catch (error: any) {
    const status = /not found/i.test(error.message) ? 404 : 500;
    return res.status(status).json({ success: false, message: error.message });
  }
};

export const provisionCustomerFromSaleController = async (
  req: CustomRequest,
  res: Response
): Promise<any> => {
  try {
    const saleId = parseInt(req.params.saleId, 10);
    if (isNaN(saleId)) {
      return res.status(400).json({ success: false, message: "Invalid sale ID" });
    }
    const brandId = req.body.brandId
      ? parseInt(req.body.brandId, 10)
      : undefined;

    const result = await CustomerAccountService.provisionFromSaleId(
      saleId,
      req.user!.id,
      brandId
    );

    return res.status(200).json({
      success: true,
      message: result.provisioned
        ? "Customer account created"
        : "Customer account not created",
      data: result,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
