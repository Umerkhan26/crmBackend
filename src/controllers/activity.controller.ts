// controllers/activity.controller.ts
import { Request, Response } from "express";
import ActivityLog from "../models/activityLog.model";

// Get all activity logs
export const getAllActivities = async (req: Request, res: Response) => {
  try {
    const logs = await ActivityLog.findAll({ order: [['created_at', 'DESC']] });
    res.status(200).json(logs);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch activity logs." });
  }
};

// ✅ Get activity logs by userId
export const getActivitiesByUserId = async (req: Request, res: Response):Promise<any> => {
  const { userId } = req.params;
  try {
    const logs = await ActivityLog.findAll({
      where: { userId },
      order: [['created_at', 'DESC']]
    });

    if (logs.length === 0) {
      return res.status(404).json({ message: "No activity logs found for this user." });
    }

    res.status(200).json(logs);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch activity logs for user." });
  }
};

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
  