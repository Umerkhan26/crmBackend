import { Request, Response } from "express";
import * as MasterSearchService from "../services/masterSearch.service";

export const masterSearch = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const query = (req.query.q as string) || "";
    const limit = parseInt(req.query.limit as string) || 5;

    if (!query || query.trim().length === 0) {
      return res.status(200).json({
        success: true,
        message: "Please provide a search query",
        query: "",
        results: {
          leads: [],
          users: [],
          campaigns: [],
          orders: [],
          products: [],
          roles: [],
          clientLeads: [],
          activityLogs: [],
        },
        totals: {
          leads: 0,
          users: 0,
          campaigns: 0,
          orders: 0,
          products: 0,
          roles: 0,
          clientLeads: 0,
          activityLogs: 0,
        },
      });
    }

    const searchResults = await MasterSearchService.masterSearch(query, limit);

    // Extract results and totals separately
    const { totals, ...results } = searchResults;

    return res.status(200).json({
      success: true,
      message: "Search completed successfully",
      query: query.trim(),
      results: results, // This should only contain leads, users, campaigns, etc. (no totals)
      totals: totals,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || "An error occurred while searching",
    });
  }
};

