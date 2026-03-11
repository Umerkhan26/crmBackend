import { Request, Response } from "express";
import * as MasterSearchService from "../services/masterSearch.service";
import User from "../models/user.model";
import Role from "../models/role.model";
import { isUserManager } from "../utils/brandUtils";

export const masterSearch = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const query = (req.query.q as string) || "";
    const limit = parseInt(req.query.limit as string) || 5;
    const userId = (req as any).user?.id;

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

    // Get user info: admin and manager get full search (same as admin)
    let hasFullSearch = false;
    let userPermissions: any[] = [];
    let allowedCampaignNames: string[] = [];

    if (userId) {
      const user = await User.findByPk(userId, {
        include: {
          model: Role,
          include: [{ model: require("../models/permission.model").default }],
        },
      }) as any;

      if (user) {
        const roleName = user.Role?.name?.toLowerCase() || "";
        const isAdmin = roleName === "admin" || roleName === "adminn";
        const isManager = await isUserManager(userId);
        hasFullSearch = isAdmin || isManager;

        if (!hasFullSearch) {
          // Get user's campaign permissions
          userPermissions = user.Role?.Permissions || [];
          const allowedCampaignIds: number[] = [];

          // Extract campaign permissions
          userPermissions.forEach((perm: any) => {
            if (perm.name === "getCampaignById" && perm.resourceId && !isNaN(Number(perm.resourceId))) {
              allowedCampaignIds.push(parseInt(perm.resourceId));
            }
            if (perm.resourceType?.startsWith("campaign-")) {
              const name = perm.resourceType.split("campaign-")[1]?.toLowerCase();
              if (name) allowedCampaignNames.push(name);
            }
            if (perm.resourceType && !perm.resourceType.startsWith("campaign-")) {
              allowedCampaignNames.push(perm.resourceType.toLowerCase());
            }
          });

          // Get campaign names from IDs
          if (allowedCampaignIds.length > 0) {
            const Campaign = require("../models/campaign.model").default;
            const campaigns = await Campaign.findAll({
              where: { id: { [require("sequelize").Op.in]: allowedCampaignIds } },
              attributes: ["campaignName"],
            });
            campaigns.forEach((c: any) => {
              const name = c.campaignName?.toLowerCase().trim();
              if (name && !allowedCampaignNames.includes(name)) {
                allowedCampaignNames.push(name);
              }
            });
          }

          // Check for general campaign permission
          const hasGeneralPermission = userPermissions.some((p: any) => p.name === "campaign:get");
          if (hasGeneralPermission && allowedCampaignNames.length === 0) {
            // User has general permission but no specific campaigns - they can see all
            allowedCampaignNames = []; // Empty array means all campaigns
          }
        }
      }
    }

    const searchResults = await MasterSearchService.masterSearch(
      query,
      limit,
      hasFullSearch ? undefined : userId,
      hasFullSearch ? undefined : allowedCampaignNames
    );

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

