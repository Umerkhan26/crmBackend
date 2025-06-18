import { Request, Response } from "express";
import ActivityLog from "../models/activityLog.model";

// GET all activity logs
export const getAllActivities = async (req: Request, res: Response) => {
  try {
    const logs = await ActivityLog.findAll({ order: [['created_at', 'DESC']] });
    res.status(200).json(logs);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch activity logs." });
  }
};

// GET a single activity log by ID
export const getActivityById = async (req: Request, res: Response):Promise<any> => {
  const { id } = req.params;
  try {
    const log = await ActivityLog.findByPk(id);
    if (!log) {
      return res.status(404).json({ error: "Activity log not found." });
    }
    res.status(200).json(log);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch the activity log." });
  }
};
