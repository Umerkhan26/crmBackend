import { Request, Response } from "express";
import { getLeadLockByLeadId, getLeadLocks, lockLead, unlockLead } from "../services/leadLock.service";

export const setLeadLockStatusController = async (req: Request, res: Response): Promise<any> => {
  try {
    const leadId = parseInt(req.params.leadId);
    if (isNaN(leadId)) return res.status(400).json({ success: false, message: "Invalid lead ID" });
    const { status, reason, lockDays, lockUntil } = req.body as {
      status?: "locked" | "unlocked";
      reason?: string;
      lockDays?: number;
      lockUntil?: string;
    };
    if (status !== "locked" && status !== "unlocked") {
      return res.status(400).json({ success: false, message: "status must be 'locked' or 'unlocked'" });
    }

    if (status === "locked") {
      const lock = await lockLead({ leadId, lockedByUserId: req.user!.id, reason, lockDays, lockUntil });
      return res.status(200).json({ success: true, message: "Lead locked successfully", data: lock });
    } else {
      const lock = await unlockLead({ leadId });
      return res.status(200).json({ success: true, message: "Lead unlocked successfully", data: lock });
    }
  } catch (error: any) {
    const code =
      error.message === "Lead not found" || error.message === "Locking user not found"
        ? 404
        : error.message === "Lead is already locked"
          ? 409
          : error.message === "Lead is not locked"
            ? 404
            : 500;
    return res.status(code).json({ success: false, message: error.message || "Error updating lead lock" });
  }
};

export const getLeadLockController = async (req: Request, res: Response): Promise<any> => {
  try {
    const leadId = parseInt(req.params.leadId);
    if (isNaN(leadId)) return res.status(400).json({ success: false, message: "Invalid lead ID" });

    const result = await getLeadLockByLeadId(leadId);
    return res.status(200).json({ success: true, message: "Lead lock status retrieved", data: result });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message || "Error fetching lock status" });
  }
};

export const getLeadLocksController = async (req: Request, res: Response): Promise<any> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = (req.query.search as string) || "";
    const status = ((req.query.status as string) || "locked") as any;

    const result = await getLeadLocks({ page, limit, search, status });
    return res.status(200).json({ success: true, message: "Lead locks retrieved successfully", ...result });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message || "Error fetching lead locks" });
  }
};
