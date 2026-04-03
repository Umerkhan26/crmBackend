import { Request, Response } from "express";
import {
  bulkPromoteIncomingLeads,
  createIncomingLead,
  deleteIncomingLead,
  getIncomingLeadById,
  getIncomingLeads,
  promoteIncomingLead,
  updateIncomingLead,
  validateIncomingLead,
} from "../services/incomingLead.service";

export const createIncomingLeadController = async (req: Request, res: Response): Promise<any> => {
  try {
    const { runId, payload, campaignName, externalId, dedupeKey } = req.body;
    const created = await createIncomingLead({ runId, payload, campaignName, externalId, dedupeKey });
    return res.status(201).json({ success: true, message: "Incoming lead created", data: created });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message || "Error creating incoming lead" });
  }
};

export const getIncomingLeadsController = async (req: Request, res: Response): Promise<any> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = (req.query.status as string) as any;
    const search = (req.query.search as string) || "";
    const runId = (req.query.runId as string) || undefined;
    const result = await getIncomingLeads({ page, limit, search, status, runId });
    return res.status(200).json({ success: true, message: "Incoming leads retrieved", ...result });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message || "Error fetching incoming leads" });
  }
};

export const getIncomingLeadByIdController = async (req: Request, res: Response): Promise<any> => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ success: false, message: "Invalid ID" });
    const data = await getIncomingLeadById(id);
    return res.status(200).json({ success: true, message: "Incoming lead retrieved", data });
  } catch (error: any) {
    const code = error.message === "Incoming lead not found" ? 404 : 500;
    return res.status(code).json({ success: false, message: error.message || "Error fetching incoming lead" });
  }
};

export const updateIncomingLeadController = async (req: Request, res: Response): Promise<any> => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ success: false, message: "Invalid ID" });
    const data = await updateIncomingLead(id, req.body || {});
    return res.status(200).json({ success: true, message: "Incoming lead updated", data });
  } catch (error: any) {
    const code = error.message === "Incoming lead not found" ? 404 : 500;
    return res.status(code).json({ success: false, message: error.message || "Error updating incoming lead" });
  }
};

export const deleteIncomingLeadController = async (req: Request, res: Response): Promise<any> => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ success: false, message: "Invalid ID" });
    const message = await deleteIncomingLead(id);
    return res.status(200).json({ success: true, message });
  } catch (error: any) {
    const code = error.message === "Incoming lead not found" ? 404 : 500;
    return res.status(code).json({ success: false, message: error.message || "Error deleting incoming lead" });
  }
};

export const validateIncomingLeadController = async (req: Request, res: Response): Promise<any> => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ success: false, message: "Invalid ID" });
    const { dedupeKey } = req.body;
    const data = await validateIncomingLead(id, dedupeKey);
    return res.status(200).json({ success: true, message: "Incoming lead validated", data });
  } catch (error: any) {
    const code = error.message === "Incoming lead not found" ? 404 : 500;
    return res.status(code).json({ success: false, message: error.message || "Error validating incoming lead" });
  }
};

export const promoteIncomingLeadController = async (req: Request, res: Response): Promise<any> => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ success: false, message: "Invalid ID" });
    const data = await promoteIncomingLead({ id, createdBy: req.user?.id });
    return res.status(200).json({ success: true, message: "Incoming lead promoted", data });
  } catch (error: any) {
    const code = error.message === "Incoming lead not found" ? 404 : 500;
    return res.status(code).json({ success: false, message: error.message || "Error promoting incoming lead" });
  }
};

export const bulkPromoteIncomingLeadsController = async (req: Request, res: Response): Promise<any> => {
  try {
    const { runId, ids } = req.body || {};
    const data = await bulkPromoteIncomingLeads({ runId, ids, createdBy: req.user?.id });
    return res.status(200).json({ success: true, message: "Bulk promotion completed", data });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message || "Bulk promotion error" });
  }
};
