import { Request, Response } from "express";
import { getDashboardStats } from "../services/dashboard.service";

export const getDashboardStatsController = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const stats = await getDashboardStats();

    return res.status(200).json({
      success: true,
      message: "Dashboard statistics fetched successfully",
      data: stats,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch dashboard statistics",
    });
  }
};



