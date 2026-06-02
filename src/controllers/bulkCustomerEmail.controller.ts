import { Response } from "express";
import { CustomRequest } from "../types/custom";
import * as BulkCustomerEmailService from "../services/bulkCustomerEmail.service";

export const createBulkCustomerEmailController = async (
  req: CustomRequest,
  res: Response
): Promise<any> => {
  try {
    const { subject, body, category, filters } = req.body;
    if (!subject?.trim() || !body?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Subject and body are required",
      });
    }

    const result = await BulkCustomerEmailService.createBulkCustomerEmailCampaign({
      subject: subject.trim(),
      body: body.trim(),
      category: category || "promotional",
      filters,
      createdBy: req.user!.id,
    });

    BulkCustomerEmailService.scheduleBulkCustomerEmailCampaign(result.campaignId);

    return res.status(202).json({
      success: true,
      message: "Bulk email campaign queued",
      data: result,
    });
  } catch (error: any) {
    const msg = error?.message || "Failed to queue bulk email";
    const status = /not found|no customers/i.test(msg) ? 400 : 500;
    return res.status(status).json({ success: false, message: msg });
  }
};

export const getBulkCustomerEmailStatusController = async (
  req: CustomRequest,
  res: Response
): Promise<any> => {
  try {
    const campaignId = parseInt(req.params.campaignId, 10);
    if (!Number.isFinite(campaignId)) {
      return res.status(400).json({ success: false, message: "Invalid campaign id" });
    }
    const data = await BulkCustomerEmailService.getBulkCustomerEmailCampaignStatus(
      campaignId
    );
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    const msg = error?.message || "Failed to get campaign status";
    const status = /not found/i.test(msg) ? 404 : 500;
    return res.status(status).json({ success: false, message: msg });
  }
};

export const cancelBulkCustomerEmailController = async (
  req: CustomRequest,
  res: Response
): Promise<any> => {
  try {
    const campaignId = parseInt(req.params.campaignId, 10);
    if (!Number.isFinite(campaignId)) {
      return res.status(400).json({ success: false, message: "Invalid campaign id" });
    }
    const data = await BulkCustomerEmailService.cancelBulkCustomerEmailCampaign(
      campaignId
    );
    return res.status(200).json({
      success: true,
      message: "Campaign cancelled",
      data,
    });
  } catch (error: any) {
    const msg = error?.message || "Failed to cancel campaign";
    const status = /not found/i.test(msg) ? 404 : /already/i.test(msg) ? 400 : 500;
    return res.status(status).json({ success: false, message: msg });
  }
};

export const listBulkCustomerEmailFailuresController = async (
  req: CustomRequest,
  res: Response
): Promise<any> => {
  try {
    const campaignId = parseInt(req.params.campaignId, 10);
    if (!Number.isFinite(campaignId)) {
      return res.status(400).json({ success: false, message: "Invalid campaign id" });
    }
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 20;
    const data = await BulkCustomerEmailService.listBulkCustomerEmailCampaignFailures(
      campaignId,
      page,
      limit
    );
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error?.message || "Failed to list failures",
    });
  }
};
