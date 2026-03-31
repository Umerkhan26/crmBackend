import { Request, Response } from "express";
import {
  createLeadAssignmentBatch,
  getLeadAssignmentBatchById,
  getLeadAssignmentBatches,
  updateLeadAssignmentBatch,
} from "../services/leadAssignmentBatch.service";

export const createLeadAssignmentBatchController = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const { runId, triggerType, metadata } = req.body;
    if (!runId) return res.status(400).json({ success: false, message: "runId is required" });

    const created = await createLeadAssignmentBatch({
      runId,
      triggerType,
      metadata,
      triggeredByUserId: req.user?.id,
    });
    return res.status(201).json({ success: true, message: "Batch created successfully", data: created });
  } catch (error: any) {
    const code = error.message?.includes("already exists") ? 409 : 500;
    return res.status(code).json({ success: false, message: error.message || "Error creating batch" });
  }
};

export const getLeadAssignmentBatchesController = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as any;
    const triggerType = req.query.triggerType as any;

    const result = await getLeadAssignmentBatches({ page, limit, status, triggerType });
    return res.status(200).json({ success: true, message: "Batches retrieved successfully", ...result });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message || "Error fetching batches" });
  }
};

export const getLeadAssignmentBatchByIdController = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ success: false, message: "Invalid batch ID" });

    const batch = await getLeadAssignmentBatchById(id);
    return res.status(200).json({ success: true, message: "Batch retrieved successfully", data: batch });
  } catch (error: any) {
    const code = error.message === "Batch not found" ? 404 : 500;
    return res.status(code).json({ success: false, message: error.message || "Error fetching batch" });
  }
};

export const updateLeadAssignmentBatchController = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ success: false, message: "Invalid batch ID" });

    const updated = await updateLeadAssignmentBatch(id, req.body || {});
    return res.status(200).json({ success: true, message: "Batch updated successfully", data: updated });
  } catch (error: any) {
    const code = error.message === "Batch not found" ? 404 : 500;
    return res.status(code).json({ success: false, message: error.message || "Error updating batch" });
  }
};
