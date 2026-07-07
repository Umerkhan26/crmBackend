import { Request, Response } from "express";
import ActivityLog from "../models/activityLog.model";
import User from "../models/user.model";
import Role from "../models/role.model";
import { getPagination, getPagingData } from "../utils/paginate";
import { enrichActivityLogRows } from "../services/activity.service";
import { Op } from "sequelize";
import { isUserManager, getManagerBrandUserIds } from "../utils/brandUtils";

export const getAllActivities = async (req: Request, res: Response): Promise<void> => {
  try {
    const authUserId = (req as any).user?.id;
    if (!authUserId) {
      res.status(401).json({ error: "Unauthorized: user ID not found" });
      return;
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const queryUserId = req.query.userId ? parseInt(req.query.userId as string) : undefined;
    const search = (req.query.search as string) || "";
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;

    const { offset } = getPagination({ page, limit });

    // Role-based filtering: admin = all, manager = brand users, simple = own
    const user = (await User.findByPk(authUserId, {
      include: [{ model: Role, as: "role" }],
    })) as any;
    const roleName = (user?.role?.name || user?.Role?.name || "").toLowerCase().trim();
    const isAdmin = roleName === "admin" || roleName === "adminn";
    const isManager = await isUserManager(authUserId);
    const brandUserIds = isManager && !isAdmin ? await getManagerBrandUserIds(authUserId) : undefined;

    // Build where clause
    const where: any = {};

    if (isAdmin) {
      // Admin: filter by query param userId if provided
      if (queryUserId && !isNaN(queryUserId)) {
        where.userId = queryUserId;
      }
    } else if (brandUserIds !== undefined) {
      // Manager
      if (brandUserIds.length === 0) {
        const emptyResponse = getPagingData({ count: 0, rows: [] }, page, limit);
        res.status(200).json(emptyResponse);
        return;
      }
      where.userId = { [Op.in]: brandUserIds };
    } else {
      // Simple user: only own activities
      where.userId = authUserId;
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

    const enrichedRows = await enrichActivityLogRows(data.rows);
    const response = getPagingData(
      { count: data.count, rows: enrichedRows },
      page,
      limit,
    );

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

    const enrichedRows = await enrichActivityLogRows(data.rows);
    const response = getPagingData(
      { count: data.count, rows: enrichedRows },
      page,
      limit,
    );
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
