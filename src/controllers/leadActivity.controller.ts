// src/controllers/leadActivity.controller.ts

import { Request, Response } from "express";
import { getAllLeadActivities, getLeadActivitiesByLeadId } from "../services/leadActivity.service";

// src/controllers/leadActivity.controller.ts


export const getLeadActivities = async (req: Request, res: Response): Promise<Response> => {
  try {
    const leadIdParam = req.params.leadId;
    const leadId = Number(leadIdParam);

    if (!leadIdParam || isNaN(leadId)) {
      return res.status(400).json({ message: "Invalid lead ID." });
    }

    // Fetch activities with related info (from updated service)
    const activities = await getLeadActivitiesByLeadId(leadId);

    return res.status(200).json({
      success: true,
      count: activities.length,
      data: activities,
    });
  } catch (error) {
    console.error("Error fetching lead activities:", error);
    return res.status(500).json({ message: "Failed to fetch lead activities." });
  }
};



export const getAllLeadActivityLogs = async (req: Request, res: Response) => {
  try {
    const logs = await getAllLeadActivities();
    res.status(200).json(logs);
  } catch (error) {
    console.error("Error fetching all lead activity logs:", error);
    res.status(500).json({ message: "Failed to retrieve activity logs" });
  }
};