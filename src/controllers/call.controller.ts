import { Request, Response } from "express";
import * as CallService from "../services/call.service";
import User from "../models/user.model";
import Role from "../models/role.model";
import { getManagerBrandUserIds, isUserManager } from "../utils/brandUtils";

const parseId = (raw: string) => {
  const n = Number(raw);
  return Number.isFinite(n) ? Math.floor(n) : NaN;
};

export const startCallController = async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = (req as any).user?.id as number | undefined;
    if (!userId) {
      return res.status(401).json({ success: false, message: "User not authenticated" });
    }

    const { phoneNumber } = req.body || {};
    if (!phoneNumber || typeof phoneNumber !== "string") {
      return res.status(400).json({ success: false, message: "phoneNumber is required" });
    }

    const call = await CallService.startCall(userId, req.body);
    return res.status(201).json({
      success: true,
      message: "Call started",
      data: call,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to start call",
    });
  }
};

export const endCallController = async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = (req as any).user?.id as number | undefined;
    if (!userId) {
      return res.status(401).json({ success: false, message: "User not authenticated" });
    }

    const callId = parseId(req.params.id);
    if (!callId) {
      return res.status(400).json({ success: false, message: "Invalid call id" });
    }

    const call = await CallService.endCall(userId, callId, req.body || {});
    if (!call) {
      return res.status(404).json({ success: false, message: "Call not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Call ended",
      data: call,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to end call",
    });
  }
};

export const updateTranscriptController = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const userId = (req as any).user?.id as number | undefined;
    if (!userId) {
      return res.status(401).json({ success: false, message: "User not authenticated" });
    }

    const callId = parseId(req.params.id);
    if (!callId) {
      return res.status(400).json({ success: false, message: "Invalid call id" });
    }

    const { transcript } = req.body || {};
    if (!transcript || typeof transcript !== "string") {
      return res.status(400).json({ success: false, message: "transcript is required" });
    }

    const call = await CallService.updateTranscript(userId, callId, req.body);
    if (!call) {
      return res.status(404).json({ success: false, message: "Call not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Transcript saved",
      data: call,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to save transcript",
    });
  }
};

export const getCallByIdController = async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = (req as any).user?.id as number | undefined;
    if (!userId) {
      return res.status(401).json({ success: false, message: "User not authenticated" });
    }

    const callId = parseId(req.params.id);
    if (!callId) {
      return res.status(400).json({ success: false, message: "Invalid call id" });
    }

    const requester = (await User.findByPk(userId, {
      include: [{ model: Role, as: "role" }],
    })) as any;
    const roleName = String(requester?.role?.name || "")
      .toLowerCase()
      .trim();
    const isStrictAdmin = roleName === "admin" || roleName === "adminn";

    const isMgr = !isStrictAdmin && (await isUserManager(userId));
    const teamIds = isMgr ? await getManagerBrandUserIds(userId) : [];

    const call = await CallService.getCallById(userId, callId, {
      allowAnyUser: isStrictAdmin,
      ...(isMgr ? { managedUserIds: teamIds } : {}),
    });
    if (!call) {
      return res.status(404).json({ success: false, message: "Call not found" });
    }

    return res.status(200).json({ success: true, data: call });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message || "Failed to fetch call" });
  }
};

export const listCallsController = async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = (req as any).user?.id as number | undefined;
    if (!userId) {
      return res.status(401).json({ success: false, message: "User not authenticated" });
    }

    const page = req.query.page ? Number(req.query.page) : 1;
    const limit = req.query.limit ? Number(req.query.limit) : 20;
    const leadId = req.query.leadId ? Number(req.query.leadId) : undefined;
    const clientLeadId = req.query.clientLeadId ? Number(req.query.clientLeadId) : undefined;

    const data = await CallService.listCalls(userId, page, limit, leadId, clientLeadId);
    return res.status(200).json({ success: true, message: "Calls fetched", ...data });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message || "Failed to list calls" });
  }
};

