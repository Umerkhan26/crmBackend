
import { Request, Response } from "express";
import {
  deleteLeadActivity,
  getActivitiesByEntity,
  getAllLeadActivities,
  getLeadActivitiesByLeadId,
  getLeadActivityReportByUser,
  updateLeadActivity,
} from "../services/leadActivity.service";


export const getLeadActivities = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const leadIdParam = req.params.leadId;
    const leadId = Number(leadIdParam);

    if (!leadIdParam || isNaN(leadId)) {
      return res.status(400).json({ message: "Invalid lead ID." });
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    // Optional: filter to one actor (agents pass their own id from FE)
    const performedByRaw = req.query.performedBy ?? req.query.userId;
    const performedBy = performedByRaw
      ? parseInt(String(performedByRaw), 10)
      : undefined;

    const activities = await getLeadActivitiesByLeadId(
      leadId,
      page,
      limit,
      Number.isFinite(performedBy as number) && (performedBy as number) > 0
        ? (performedBy as number)
        : undefined,
    );

    return res.status(200).json({
      success: true,
      ...activities,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Failed to fetch lead activities." });
  }
};

export const getAllLeadActivityLogs = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    const logs = await getAllLeadActivities(page, limit);

    res.status(200).json({
      success: true,
      ...logs,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to retrieve activity logs" });
  }
};

export const getActivityLogsByEntity = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const { entityId, entityType } = req.params;

    const numericEntityId = Number(entityId);
    if (isNaN(numericEntityId)) {
      return res.status(400).json({ message: "Invalid entity ID." });
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    const logs = await getActivitiesByEntity(
      numericEntityId,
      entityType as "lead" | "clientLead",
      page,
      limit
    );

    res.status(200).json({
      success: true,
      ...logs,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch activity logs." });
  }
};

export const updateLeadActivityController = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid activity ID" });
    }

    const updatedActivity = await updateLeadActivity(id, req.body);
    res.json(updatedActivity);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteLeadActivityController = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const id = parseInt(req.params.id, 10);
    const deletedBy = req.user?.id || req.body.deletedBy;

    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid activity ID" });
    }

    if (!deletedBy) {
      return res.status(400).json({ message: "Missing deletedBy (user ID)" });
    }

    const result = await deleteLeadActivity(id, deletedBy);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};



export const getLeadActivityReportByUserController = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const { userId, period, ...customFilter } = req.query;
    if (
      !period ||
      typeof period !== "string" ||
      !["daily", "weekly", "monthly", "custom"].includes(period)
    ) {
      return res
        .status(400)
        .json({ message: "Invalid or missing 'period' parameter" });
    }
    if (!userId || isNaN(Number(userId))) {
      return res
        .status(400)
        .json({ message: "Invalid or missing 'userId' parameter" });
    }
    const report = await getLeadActivityReportByUser(
      Number(userId),
      period as "daily" | "weekly" | "monthly" | "custom",
      customFilter
    );
    if (!report || (Array.isArray(report) && report.length === 0)) {
      return res.status(200).json({
        success: true,
        message: "No lead activity found for this user and period",
        data: [],
      });
    }
    return res.status(200).json({
      success: true,
      message: "Lead activity report fetched successfully",
      data: report,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: "Failed to generate activity report",
      error: error.message,
    });
  }
};









