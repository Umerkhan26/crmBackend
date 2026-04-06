import { Request, Response } from "express";
import { assignByDateToTeamA, rebalanceTeam, rotateByTenure, runManualAutoAssignment } from "../services/autoAssignment.service";

const formatAssignmentError = (error: any): { status: number; message: string } => {
  if (!error) return { status: 500, message: "Unknown error" };
  const name = error.name as string | undefined;
  if (name === "SequelizeUniqueConstraintError") {
    return {
      status: 409,
      message:
        "A batch record with this key already exists. Retry the operation; audit batch ids are generated uniquely per run.",
    };
  }
  if (name === "SequelizeValidationError" && Array.isArray(error.errors) && error.errors.length > 0) {
    return {
      status: 400,
      message: error.errors.map((e: any) => e.message).join("; "),
    };
  }
  const msg = error.message || "Request failed";
  if (/not found|Invalid team|No active members|rotation order is empty|rotation config/i.test(msg)) {
    return { status: 400, message: msg };
  }
  return { status: 500, message: msg };
};

export const runManualAutoAssignmentController = async (req: Request, res: Response): Promise<any> => {
  try {
    const { runId, tenureHours } = req.body || {};
    if (!runId) return res.status(400).json({ success: false, message: "runId is required" });
    const result = await runManualAutoAssignment({
      runId,
      tenureHours: Number.isFinite(Number(tenureHours)) ? Number(tenureHours) : undefined,
      triggeredByUserId: req.user?.id,
    });
    return res.status(200).json({ success: true, message: "Auto-assignment run completed", data: result });
  } catch (error: any) {
    const { status, message } = formatAssignmentError(error);
    return res.status(status).json({ success: false, message });
  }
};

export const assignByDateToTeamAController = async (req: Request, res: Response): Promise<any> => {
  try {
    const { window, tz, customStart, customEnd, runId } = req.body || {};
    const data = await assignByDateToTeamA({
      ...(window !== undefined && window !== "" ? { window } : {}),
      ...(tz !== undefined && String(tz).trim() !== "" ? { tz } : {}),
      customStart,
      customEnd,
      runId,
      triggeredByUserId: req.user?.id,
    });
    return res.status(200).json({ success: true, message: "Assigned to Team A by date window", data });
  } catch (error: any) {
    const { status, message } = formatAssignmentError(error);
    return res.status(status).json({ success: false, message });
  }
};

export const rebalanceTeamController = async (req: Request, res: Response): Promise<any> => {
  try {
    const teamId = parseInt(req.params.teamId);
    if (isNaN(teamId)) return res.status(400).json({ success: false, message: "Invalid team ID" });
    const labelRunId = (req.body || {}).labelRunId ?? (req.body || {}).runId;
    const data = await rebalanceTeam({
      teamId,
      triggeredByUserId: req.user?.id,
      labelRunId: typeof labelRunId === "string" ? labelRunId : undefined,
    });
    return res.status(200).json({ success: true, message: "Team rebalanced", data });
  } catch (error: any) {
    const { status, message } = formatAssignmentError(error);
    return res.status(status).json({ success: false, message });
  }
};

export const rotateByTenureController = async (req: Request, res: Response): Promise<any> => {
  try {
    const body = req.body || {};
    const raw = body.tenureHours;
    const tenureHours =
      raw !== undefined && raw !== null && String(raw).trim() !== "" && Number.isFinite(Number(raw)) && Number(raw) >= 0
        ? Number(raw)
        : undefined;
    const labelRunId = body.labelRunId ?? body.runId;
    const data = await rotateByTenure({
      tenureHours,
      triggeredByUserId: req.user?.id,
      labelRunId: typeof labelRunId === "string" ? labelRunId : undefined,
    });
    return res.status(200).json({ success: true, message: "Rotation completed", data });
  } catch (error: any) {
    const { status, message } = formatAssignmentError(error);
    return res.status(status).json({ success: false, message });
  }
};

