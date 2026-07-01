import { Response } from "express";
import { CustomRequest } from "../types/custom";
import * as BrandEmailSenderService from "../services/brandEmailSender.service";

const parseBrandId = (req: CustomRequest): number => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) throw new Error("Invalid brand id");
  return id;
};

export const listCustomerEmailTypesController = async (
  _req: CustomRequest,
  res: Response
): Promise<any> => {
  return res.status(200).json({
    success: true,
    data: BrandEmailSenderService.listCustomerEmailTypes(),
  });
};

export const listBrandEmailSendersController = async (
  req: CustomRequest,
  res: Response
): Promise<any> => {
  try {
    const brandId = parseBrandId(req);
    const data = await BrandEmailSenderService.listBrandEmailSenders(brandId);
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    const msg = error?.message || "Failed to list email senders";
    const status = /not found/i.test(msg) ? 404 : 500;
    return res.status(status).json({ success: false, message: msg });
  }
};

export const upsertBrandEmailSenderController = async (
  req: CustomRequest,
  res: Response
): Promise<any> => {
  try {
    const brandId = parseBrandId(req);
    const {
      smtpHost,
      smtpPort,
      smtpUser,
      smtpPassword,
      fromName,
      replyTo,
      isActive,
    } = req.body;
    const data = await BrandEmailSenderService.upsertBrandEmailSender({
      brandId,
      emailType: req.params.emailType,
      smtpHost,
      smtpPort: smtpPort ?? 465,
      smtpUser,
      smtpPassword,
      fromName,
      replyTo,
      isActive,
    });
    return res.status(200).json({
      success: true,
      message: "Email sender saved",
      data,
    });
  } catch (error: any) {
    const msg = error?.message || "Failed to save email sender";
    const status = /not found|required|invalid/i.test(msg) ? 400 : 500;
    return res.status(status).json({ success: false, message: msg });
  }
};

export const deactivateBrandEmailSenderController = async (
  req: CustomRequest,
  res: Response
): Promise<any> => {
  try {
    const brandId = parseBrandId(req);
    const data = await BrandEmailSenderService.deactivateBrandEmailSender(
      brandId,
      req.params.emailType
    );
    return res.status(200).json({
      success: true,
      message: "Email sender deactivated",
      data,
    });
  } catch (error: any) {
    const msg = error?.message || "Failed to deactivate sender";
    const status = /not found/i.test(msg) ? 404 : 500;
    return res.status(status).json({ success: false, message: msg });
  }
};

export const testBrandEmailSenderController = async (
  req: CustomRequest,
  res: Response
): Promise<any> => {
  try {
    const brandId = parseBrandId(req);
    const { toEmail } = req.body;
    const data = await BrandEmailSenderService.sendBrandEmailSenderTest({
      brandId,
      emailType: req.params.emailType,
      toEmail,
    });
    return res.status(200).json({
      success: true,
      message: "Test email sent",
      data,
    });
  } catch (error: any) {
    const msg = error?.message || "Failed to send test email";
    const status = /not found|valid|configured/i.test(msg) ? 400 : 500;
    return res.status(status).json({ success: false, message: msg });
  }
};
