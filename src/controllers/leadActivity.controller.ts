// src/controllers/leadActivity.controller.ts

import { Request, Response } from "express";
import {
  deleteLeadActivity,
  getActivitiesByEntity,
  getAllLeadActivities,
  getLeadActivitiesByLeadId,
  getLeadActivityReportByUser,
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




export const getLeadActivityReportByUserController = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const { userId, period } = req.query;

    // 🟢 Validate 'period'
    if (
      !period ||
      typeof period !== "string" ||
      !["daily", "weekly", "monthly"].includes(period)
    ) {
      return res
        .status(400)
        .json({ message: "Invalid or missing 'period' parameter" });
    }

    // 🟢 Validate 'userId'
    if (!userId || isNaN(Number(userId))) {
      return res
        .status(400)
        .json({ message: "Invalid or missing 'userId' parameter" });
    }

    // 🟢 Fetch report for specific user
    const report = await getLeadActivityReportByUser(
      Number(userId),
      period as "daily" | "weekly" | "monthly"
    );

    // 🟢 Handle case: no data found
    if (!report || (Array.isArray(report) && report.length === 0)) {
      return res.status(200).json({
        success: true,
        message: "No lead activity found for this user and period",
        data: [],
      });
    }

    // 🟢 Successful response
    return res.status(200).json({
      success: true,
      message: "Lead activity report fetched successfully",
      data: report,
    });
  } catch (error: any) {
    console.error("Error generating lead activity report:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to generate activity report",
      error: error.message,
    });
  }
};




// export const getLeadActivityReportByUserController = async (
//   req: Request,
//   res: Response
// ): Promise<any> => {
//   try {
//     const { period } = req.query;

//     // ✅ Validate query param type and value
//     if (
//       !period ||
//       typeof period !== "string" ||
//       !["daily", "weekly", "monthly"].includes(period)
//     ) {
//       return res.status(400).json({ message: "Invalid or missing 'period' parameter" });
//     }

//     // ✅ Fetch report
//     const report = await getLeadActivityReportByUser(period as "daily" | "weekly" | "monthly");

//     // ✅ Handle empty case gracefully
//     if (!report || report.length === 0) {
//       return res.status(200).json({
//         success: true,
//         message: "No lead activity found for this period",
//         totalUsers: 0,
//         data: [],
//       });
//     }

//     // ✅ Successful response
//     return res.status(200).json({
//       success: true,
//       totalUsers: report.length,
//       data: report,
//     });
//   } catch (error: any) {
//     console.error("Error generating lead activity report:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Failed to generate activity report",
//       error: error.message,
//     });
//   }
// };