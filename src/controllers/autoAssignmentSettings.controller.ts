import { Request, Response } from "express";
import { getAutoAssignmentSettings, updateAutoAssignmentSettings } from "../services/autoAssignment.service";

export const getAutoAssignmentSettingsController = async (_req: Request, res: Response): Promise<any> => {
  try {
    const data = await getAutoAssignmentSettings();
    return res.status(200).json({ success: true, message: "Auto-assignment settings retrieved", data });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message || "Settings fetch error" });
  }
};

export const updateAutoAssignmentSettingsController = async (req: Request, res: Response): Promise<any> => {
  try {
    const data = await updateAutoAssignmentSettings(req.body || {});
    return res.status(200).json({ success: true, message: "Auto-assignment settings updated", data });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message || "Settings update error" });
  }
};

