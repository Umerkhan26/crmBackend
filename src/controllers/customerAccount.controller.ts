import { Response } from "express";
import { CustomRequest } from "../types/custom";
import * as CustomerAccountService from "../services/customerAccount.service";
import {
  getCustomerAccountInsights,
  getCustomerEngagementsFeed,
  getCustomerTimelineFeed,
  listScopedCustomerEngagements,
} from "../services/customerAccountInsights.service";
import * as CustomerEngagementService from "../services/customerEngagement.service";
import { getCustomerPortalActivity, listRecentPortalActivity } from "../services/portalActivity.service";
import { listRecentEmailOpens } from "../services/emailOpenTracking.service";
import { serializeCustomerAccount } from "../utils/portalCustomerResponse";

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

    const statusRaw = String(req.query.status || "").toLowerCase();
    const status =
      statusRaw === "active" || statusRaw === "suspended"
        ? (statusRaw as "active" | "suspended")
        : undefined;

    const hasOrderRaw = String(req.query.hasOrder || "").toLowerCase();
    const hasOrder =
      hasOrderRaw === "yes" || hasOrderRaw === "no"
        ? (hasOrderRaw as "yes" | "no")
        : undefined;

    const emailFilterRaw = String(req.query.emailFilter || "").toLowerCase();
    const emailFilter =
      emailFilterRaw === "never" || emailFilterRaw === "opened"
        ? (emailFilterRaw as "never" | "opened")
        : undefined;

    const memberSinceFrom =
      typeof req.query.memberSinceFrom === "string"
        ? req.query.memberSinceFrom
        : undefined;
    const memberSinceTo =
      typeof req.query.memberSinceTo === "string"
        ? req.query.memberSinceTo
        : undefined;

    const userId = req.user?.id;
    const permissions = req.user?.permissions || [];

    const data = await CustomerAccountService.listCustomerAccounts({
      page,
      limit,
      search,
      brandId,
      status,
      hasOrder,
      emailFilter,
      memberSinceFrom,
      memberSinceTo,
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

export const previewCustomerEngagementEmailController = async (
  req: CustomRequest,
  res: Response
): Promise<any> => {
  try {
    const brandId = req.body.brandId
      ? parseInt(String(req.body.brandId), 10)
      : null;
    const data = await CustomerEngagementService.previewCustomerEngagementEmail({
      subject: req.body.subject,
      body: req.body.body,
      brandId: Number.isFinite(brandId) ? brandId : null,
      firstname: req.body.firstname,
      lastname: req.body.lastname,
    });
    return res.status(200).json({ success: true, data });
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
    return res.status(200).json({
      success: true,
      data: serializeCustomerAccount(account),
    });
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
    await CustomerAccountService.getCustomerAccountById(
      id,
      req.user?.id,
      req.user?.permissions || [],
    );
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

const assertCustomerWriteAccess = async (req: CustomRequest, accountId: number) => {
  await CustomerAccountService.getCustomerAccountById(
    accountId,
    req.user?.id,
    req.user?.permissions || [],
  );
};

export const listScopedCustomerEngagementsController = async (
  req: CustomRequest,
  res: Response
): Promise<any> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const page = parseInt(String(req.query.page || "1"), 10) || 1;
    const limit = parseInt(String(req.query.limit || "30"), 10) || 30;
    const type = typeof req.query.type === "string" ? req.query.type : undefined;
    const search = typeof req.query.search === "string" ? req.query.search : undefined;
    const brandId = req.query.brandId
      ? parseInt(String(req.query.brandId), 10)
      : undefined;

    const data = await listScopedCustomerEngagements({
      page,
      limit,
      type,
      search,
      brandId: Number.isFinite(brandId) ? brandId : undefined,
      viewerUserId: userId,
      viewerPermissions: req.user?.permissions || [],
    });

    return res.status(200).json({
      success: true,
      message: "Customer engagements fetched",
      ...data,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const listRecentPortalActivityController = async (
  req: CustomRequest,
  res: Response
): Promise<any> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const page = parseInt(String(req.query.page || "1"), 10) || 1;
    const limit = parseInt(String(req.query.limit || "20"), 10) || 20;
    const search =
      typeof req.query.search === "string" ? req.query.search : undefined;
    const brandId = req.query.brandId
      ? parseInt(String(req.query.brandId), 10)
      : undefined;
    const dateFrom =
      typeof req.query.dateFrom === "string" ? req.query.dateFrom : undefined;
    const dateTo =
      typeof req.query.dateTo === "string" ? req.query.dateTo : undefined;

    const data = await listRecentPortalActivity({
      page,
      limit,
      search,
      brandId: Number.isFinite(brandId) ? brandId : undefined,
      dateFrom,
      dateTo,
      viewerUserId: userId,
      viewerPermissions: req.user?.permissions || [],
    });

    return res.status(200).json({
      success: true,
      message: "Portal activity fetched",
      ...data,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const listRecentEmailOpensController = async (
  req: CustomRequest,
  res: Response
): Promise<any> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const page = parseInt(String(req.query.page || "1"), 10) || 1;
    const limit = parseInt(String(req.query.limit || "20"), 10) || 20;
    const search =
      typeof req.query.search === "string" ? req.query.search : undefined;
    const brandId = req.query.brandId
      ? parseInt(String(req.query.brandId), 10)
      : undefined;
    const dateFrom =
      typeof req.query.dateFrom === "string" ? req.query.dateFrom : undefined;
    const dateTo =
      typeof req.query.dateTo === "string" ? req.query.dateTo : undefined;
    const openedOnly =
      String(req.query.openedOnly || "").toLowerCase() === "true";

    const data = await listRecentEmailOpens({
      page,
      limit,
      search,
      brandId: Number.isFinite(brandId) ? brandId : undefined,
      dateFrom,
      dateTo,
      openedOnly,
      viewerUserId: userId,
      viewerPermissions: req.user?.permissions || [],
    });

    return res.status(200).json({
      success: true,
      message: "Email opens fetched",
      ...data,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getCustomerPortalActivityController = async (
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
    const data = await getCustomerPortalActivity(id, page, limit);
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    const msg = error?.message || "Failed to load portal activity";
    const status =
      /not found/i.test(msg) || /do not have access/i.test(msg) ? 404 : 500;
    return res.status(status).json({ success: false, message: msg });
  }
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
    await assertCustomerWriteAccess(req, accountId);
    const { subject, body, category, emailType } = req.body;
    if (!subject?.trim() || !body?.trim()) {
      return res.status(400).json({ success: false, message: "Subject and body required" });
    }
    const data = await CustomerEngagementService.sendEmailToCustomerAccount({
      accountId,
      subject: subject.trim(),
      body: body.trim(),
      category: category || "promotional",
      emailType,
      createdBy: req.user!.id,
    });
    return res.status(200).json({ success: true, message: "Email sent", data });
  } catch (error: any) {
    const msg = error?.message || "Failed to send email";
    const status = /not found/i.test(msg)
      ? 404
      : /do not have access/i.test(msg)
        ? 403
        : 500;
    return res.status(status).json({ success: false, message: msg });
  }
};

export const applyCustomerDiscountController = async (
  req: CustomRequest,
  res: Response
): Promise<any> => {
  try {
    const accountId = parseAccountId(req);
    await assertCustomerWriteAccess(req, accountId);
    const data = await CustomerEngagementService.applyCustomerDiscount({
      accountId,
      saleId: req.body.saleId != null ? Number(req.body.saleId) : undefined,
      discountPercent: req.body.discountPercent,
      discountCode: req.body.discountCode,
      note: req.body.note,
      validUntil: req.body.validUntil,
      createdBy: req.user!.id,
    });
    return res.status(200).json({ success: true, message: "Discount applied", data });
  } catch (error: any) {
    const msg = error?.message || "Failed to apply discount";
    const status = /not found/i.test(msg)
      ? 404
      : /do not have access/i.test(msg)
        ? 403
        : 500;
    return res.status(status).json({ success: false, message: msg });
  }
};

export const createCustomerUpsellController = async (
  req: CustomRequest,
  res: Response
): Promise<any> => {
  try {
    const accountId = parseAccountId(req);
    await assertCustomerWriteAccess(req, accountId);
    const { productName, price, description } = req.body;
    if (!productName?.trim()) {
      return res.status(400).json({ success: false, message: "Product name required" });
    }
    const data = await CustomerEngagementService.createUpsellOffer({
      accountId,
      saleId: req.body.saleId != null ? Number(req.body.saleId) : undefined,
      productName: productName.trim(),
      price,
      description,
      createdBy: req.user!.id,
    });
    return res.status(200).json({ success: true, message: "Upsell offer created", data });
  } catch (error: any) {
    const msg = error?.message || "Failed to create upsell";
    const status = /not found/i.test(msg)
      ? 404
      : /do not have access/i.test(msg)
        ? 403
        : 500;
    return res.status(status).json({ success: false, message: msg });
  }
};

export const sendCustomerNotificationController = async (
  req: CustomRequest,
  res: Response
): Promise<any> => {
  try {
    const accountId = parseAccountId(req);
    await assertCustomerWriteAccess(req, accountId);
    const { message, sendEmailAlso, emailType } = req.body;
    if (!message?.trim()) {
      return res.status(400).json({ success: false, message: "Message required" });
    }
    const data = await CustomerEngagementService.sendCustomerNotification({
      accountId,
      message: message.trim(),
      sendEmailAlso: !!sendEmailAlso,
      emailType,
      createdBy: req.user!.id,
    });
    return res.status(200).json({ success: true, message: "Notification sent", data });
  } catch (error: any) {
    const msg = error?.message || "Failed to send notification";
    const status = /not found/i.test(msg)
      ? 404
      : /do not have access/i.test(msg)
        ? 403
        : 500;
    return res.status(status).json({ success: false, message: msg });
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

    const resend = Boolean(req.body.resend);

    const result = await CustomerAccountService.provisionFromSaleId(
      saleId,
      req.user!.id,
      brandId,
      { resend },
    );

    const message = result.emailSent
      ? result.reason === "credentials_resent"
        ? "New login password sent by email"
        : "Customer account created and credentials emailed"
      : result.provisioned
        ? "Customer account created"
        : result.skipped
          ? "Could not send credentials"
          : "Customer account not created";

    return res.status(200).json({
      success: true,
      message,
      data: result,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
