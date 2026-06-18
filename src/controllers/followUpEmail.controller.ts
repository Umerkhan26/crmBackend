import { Response } from "express";
import { CustomRequest } from "../types/custom";
import * as FollowUpEmailService from "../services/followUpEmail.service";
import * as FollowUpEmailProcessor from "../services/followUpEmailProcessor.service";

export const listFollowUpSequencesController = async (
  _req: CustomRequest,
  res: Response
): Promise<any> => {
  try {
    const data = await FollowUpEmailService.listFollowUpSequences();
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error?.message || "Failed to list follow-up sequences",
    });
  }
};

export const updateFollowUpSequenceController = async (
  req: CustomRequest,
  res: Response
): Promise<any> => {
  try {
    const sequenceId = parseInt(req.params.sequenceId, 10);
    if (!Number.isFinite(sequenceId)) {
      return res.status(400).json({ success: false, message: "Invalid sequence id" });
    }
    const data = await FollowUpEmailService.updateFollowUpSequence(
      sequenceId,
      req.body
    );
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    const msg = error?.message || "Failed to update sequence";
    const status = /not found/i.test(msg) ? 404 : 500;
    return res.status(status).json({ success: false, message: msg });
  }
};

export const listFollowUpStepsContentController = async (
  req: CustomRequest,
  res: Response
): Promise<any> => {
  try {
    const sequenceId = req.query.sequenceId
      ? parseInt(req.query.sequenceId as string, 10)
      : undefined;
    const data = await FollowUpEmailService.listFollowUpStepsContent(sequenceId);
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error?.message || "Failed to list follow-up content",
    });
  }
};

export const createFollowUpStepContentController = async (
  req: CustomRequest,
  res: Response
): Promise<any> => {
  try {
    const { sequenceId, name, subject, body, sortOrder, isActive } = req.body;
    if (!sequenceId || !name?.trim() || !subject?.trim() || !body?.trim()) {
      return res.status(400).json({
        success: false,
        message: "sequenceId, name, subject, and body are required",
      });
    }
    const data = await FollowUpEmailService.createFollowUpStepContent({
      sequenceId: Number(sequenceId),
      name,
      subject,
      body,
      sortOrder,
      isActive,
    });
    return res.status(201).json({ success: true, data });
  } catch (error: any) {
    const msg = error?.message || "Failed to create follow-up step";
    const status = /not found/i.test(msg) ? 404 : 500;
    return res.status(status).json({ success: false, message: msg });
  }
};

export const updateFollowUpStepContentController = async (
  req: CustomRequest,
  res: Response
): Promise<any> => {
  try {
    const stepId = parseInt(req.params.stepId, 10);
    if (!Number.isFinite(stepId)) {
      return res.status(400).json({ success: false, message: "Invalid step id" });
    }
    const data = await FollowUpEmailService.updateFollowUpStepContent(
      stepId,
      req.body
    );
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    const msg = error?.message || "Failed to update follow-up step";
    const status = /not found/i.test(msg) ? 404 : 500;
    return res.status(status).json({ success: false, message: msg });
  }
};

export const deleteFollowUpStepController = async (
  req: CustomRequest,
  res: Response
): Promise<any> => {
  try {
    const stepId = parseInt(req.params.stepId, 10);
    if (!Number.isFinite(stepId)) {
      return res.status(400).json({ success: false, message: "Invalid step id" });
    }
    const data = await FollowUpEmailService.deleteFollowUpStep(stepId);
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    const msg = error?.message || "Failed to delete follow-up step";
    const status = /not found/i.test(msg) ? 404 : 500;
    return res.status(status).json({ success: false, message: msg });
  }
};

export const listFollowUpStepTimingsController = async (
  req: CustomRequest,
  res: Response
): Promise<any> => {
  try {
    const sequenceId = req.query.sequenceId
      ? parseInt(req.query.sequenceId as string, 10)
      : undefined;
    const data = await FollowUpEmailService.listFollowUpStepTimings(sequenceId);
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error?.message || "Failed to list follow-up timings",
    });
  }
};

export const updateFollowUpStepTimingController = async (
  req: CustomRequest,
  res: Response
): Promise<any> => {
  try {
    const stepId = parseInt(req.params.stepId, 10);
    if (!Number.isFinite(stepId)) {
      return res.status(400).json({ success: false, message: "Invalid step id" });
    }
    const { delayAmount, delayUnit, isActive } = req.body;
    if (delayAmount == null) {
      return res.status(400).json({
        success: false,
        message: "delayAmount is required",
      });
    }
    const data = await FollowUpEmailService.updateFollowUpStepTiming(stepId, {
      delayAmount: Number(delayAmount),
      delayUnit,
      isActive,
    });
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    const msg = error?.message || "Failed to update follow-up timing";
    const status = /not found/i.test(msg) ? 404 : 400;
    return res.status(status).json({ success: false, message: msg });
  }
};

export const listFollowUpEnrollmentsController = async (
  req: CustomRequest,
  res: Response
): Promise<any> => {
  try {
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 20;
    const status = req.query.status as string | undefined;
    const brandId = req.query.brandId
      ? parseInt(String(req.query.brandId), 10)
      : undefined;
    const data = await FollowUpEmailService.listFollowUpEnrollments({
      page,
      limit,
      status,
      brandId: Number.isFinite(brandId) ? brandId : undefined,
    });
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error?.message || "Failed to list enrollments",
    });
  }
};

export const getFollowUpStatsController = async (
  _req: CustomRequest,
  res: Response
): Promise<any> => {
  try {
    const data = await FollowUpEmailService.getFollowUpStats();
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error?.message || "Failed to get follow-up stats",
    });
  }
};

export const processFollowUpEmailsNowController = async (
  _req: CustomRequest,
  res: Response
): Promise<any> => {
  try {
    const data = await FollowUpEmailProcessor.processDueFollowUpEmails();
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error?.message || "Failed to process follow-up emails",
    });
  }
};
