// controllers/activity.controller.ts
import { Request, Response } from "express";
import ActivityLog from "../models/activityLog.model";
import { getPagination, getPagingData } from "../utils/paginate";

export const getAllActivities = async (req: Request, res: Response) => {
  try {
    // Get page and limit from query params
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    const { offset } = getPagination({ page, limit });

    // Use findAndCountAll for pagination
    const data = await ActivityLog.findAndCountAll({
      order: [['created_at', 'DESC']],
      limit,
      offset,
    });

    const response = getPagingData(data, page, limit);

    res.status(200).json(response);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch activity logs." });
  }
};

// ✅ Get activity logs by userId with pagination
export const getActivitiesByUserId = async (req: Request, res: Response): Promise<any> => {
  const { userId } = req.params;

  // Parse page and limit from query params
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;

  try {
    const { offset } = getPagination({ page, limit });

    // Use findAndCountAll for pagination
    const data = await ActivityLog.findAndCountAll({
      where: { userId },
      order: [['created_at', 'DESC']],
      limit,
      offset,
    });

    if (data.count === 0) {
      return res.status(404).json({ message: "No activity logs found for this user." });
    }

    const response = getPagingData(data, page, limit);
    res.status(200).json(response);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch activity logs for user." });
  }
};

0
export const deleteActivityById = async (req: Request, res: Response):Promise<any> => {
    const { id } = req.params;
  
    try {
      const deleted = await ActivityLog.destroy({ where: { id } });
  
      if (deleted === 0) {
        return res.status(404).json({ message: "Activity log not found." });
      }
  
      res.status(200).json({ message: "Activity log deleted successfully." });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete activity log." });
    }
  };
  