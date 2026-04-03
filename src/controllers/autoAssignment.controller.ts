import { Request, Response } from "express";
import { assignByDateToTeamA, rebalanceTeam, rotateByTenure, runManualAutoAssignment } from "../services/autoAssignment.service";

export const runManualAutoAssignmentController = async (req: Request, res: Response): Promise<any> => {
  try {
    const { runId, tenureHours } = req.body || {};
    if (!runId) return res.status(400).json({ success: false, message: "runId is required" });
    const result = await runManualAutoAssignment({
      runId,
      tenureHours: Number.isFinite(Number(tenureHours)) ? Number(tenureHours) : 1,
      triggeredByUserId: req.user?.id,
    });
    return res.status(200).json({ success: true, message: "Auto-assignment run completed", data: result });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message || "Auto-assignment error" });
  }
};

export const assignByDateToTeamAController = async (req: Request, res: Response): Promise<any> => {
  try {
    const { window = "yesterday", tz = "Asia/Karachi", customStart, customEnd, runId } = req.body || {};
    const data = await assignByDateToTeamA({
      window,
      tz,
      customStart,
      customEnd,
      runId,
      triggeredByUserId: req.user?.id,
    });
    return res.status(200).json({ success: true, message: "Assigned to Team A by date window", data });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message || "Assign-by-date error" });
  }
};

export const rebalanceTeamController = async (req: Request, res: Response): Promise<any> => {
  try {
    const teamId = parseInt(req.params.teamId);
    if (isNaN(teamId)) return res.status(400).json({ success: false, message: "Invalid team ID" });
    const data = await rebalanceTeam({ teamId });
    return res.status(200).json({ success: true, message: "Team rebalanced", data });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message || "Rebalance error" });
  }
};

export const rotateByTenureController = async (req: Request, res: Response): Promise<any> => {
  try {
    const { tenureHours = 24 } = req.body || {};
    const data = await rotateByTenure({ tenureHours });
    return res.status(200).json({ success: true, message: "Rotation completed", data });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message || "Rotation error" });
  }
};

