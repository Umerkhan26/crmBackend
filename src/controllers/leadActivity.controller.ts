// src/controllers/leadActivity.controller.ts

import { Request, Response } from "express";
import {
  deleteLeadActivity,
  getActivitiesByEntity,
  getAllLeadActivities,
  getLeadActivitiesByLeadId,
  updateLeadActivity,
} from "../services/leadActivity.service";

// src/controllers/leadActivity.controller.ts

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

    // Parse page and limit from query params
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    // Fetch paginated activities from service
    const activities = await getLeadActivitiesByLeadId(leadId, page, limit);

    return res.status(200).json({
      success: true,
      ...activities, // contains totalItems, data, totalPages, currentPage
    });
  } catch (error) {
    console.error("Error fetching lead activities:", error);
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
      ...logs, // totalItems, data, totalPages, currentPage
    });
  } catch (error) {
    console.error("Error fetching all lead activity logs:", error);
    res.status(500).json({ message: "Failed to retrieve activity logs" });
  }
};

export const getActivityLogsByEntity = async (req: Request, res: Response):Promise<any> => {
  try {
    const { entityId, entityType } = req.params;

    const numericEntityId = Number(entityId);
    if (isNaN(numericEntityId)) {
      return res.status(400).json({ message: "Invalid entity ID." });
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    const logs = await getActivitiesByEntity(numericEntityId, entityType as "lead" | "clientLead", page, limit);

    res.status(200).json({
      success: true,
      ...logs,
    });
  } catch (error) {
    console.error("Error fetching activity logs by entity:", error);
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
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid activity ID" });
    }

    const result = await deleteLeadActivity(id);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
