import { Request, Response } from "express";
import ActivityLog from "../models/activityLog.model";
import { getPagination, getPagingData } from "../utils/paginate";
import { Op } from "sequelize";

export const getAllActivities = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const userId = req.query.userId ? parseInt(req.query.userId as string) : undefined;
    const search = (req.query.search as string) || "";
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;

    const { offset } = getPagination({ page, limit });

    // Build where clause
    const where: any = {};

    // Filter by user ID if provided
    if (userId && !isNaN(userId)) {
      where.userId = userId;
    }

    // Search filter
    if (search.trim()) {
      where[Op.or] = [
        { action: { [Op.like]: `%${search}%` } },
        { details: { [Op.like]: `%${search}%` } },
        { userName: { [Op.like]: `%${search}%` } },
      ];
    }

    // Date filter
    if (startDate || endDate) {
      where.created_at = {};
      if (startDate) {
        where.created_at[Op.gte] = new Date(startDate);
      }
      if (endDate) {
        // Set end date to end of day
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999);
        where.created_at[Op.lte] = endDateTime;
      }
    }

    const data = await ActivityLog.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      limit,
      offset,
    });

    const response = getPagingData(data, page, limit);

    res.status(200).json(response);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to fetch activity logs." });
  }
};

export const getActivitiesByUserId = async (req: Request, res: Response): Promise<any> => {
  const { userId } = req.params;

  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;

  try {
    const { offset } = getPagination({ page, limit });

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
    res.status(500).json({ error: "Failed to fetch activity logs for user." });
  }
};

export const deleteActivityById = async (req: Request, res: Response): Promise<any> => {
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
