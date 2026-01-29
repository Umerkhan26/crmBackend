import { Request, Response } from "express";
import { getDashboardStats } from "../services/dashboard.service";
import User from "../models/user.model";
import Role from "../models/role.model";
import Permission from "../models/permission.model";

export const getDashboardStatsController = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    // Get user from request (set by verifyToken middleware)
    const userId = (req as any).user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    // Optional date filters from query
    const { filterType = "", startDate, endDate } = req.query as {
      filterType?: string;
      startDate?: string;
      endDate?: string;
    };

    // Get user with role to check if admin
    const user = await User.findByPk(userId, {
      include: {
        model: Role,
        include: [Permission],
      },
    }) as any;

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Check if user is admin
    const roleName = user.Role?.name?.toLowerCase() || "";
    const isAdmin = roleName === "admin" || roleName === "adminn";

    // Get dashboard stats (admin gets global, non-admin gets user-specific)
    const stats = await getDashboardStats({
      userId,
      isAdmin,
      userRole: user.Role,
      filterType: (filterType || "").trim() as any,
      startDate,
      endDate,
    });

    return res.status(200).json({
      success: true,
      message: "Dashboard statistics fetched successfully",
      data: stats,
      isAdmin, // Include admin flag in response for frontend
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch dashboard statistics",
    });
  }
};



