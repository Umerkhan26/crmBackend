import User from "../models/user.model";
import Lead from "../models/lead.model";
import ProductSale from "../models/product.model";
import Campaign from "../models/campaign.model";
import Role from "../models/role.model";
import Permission from "../models/permission.model";
import { Op, Sequelize } from "sequelize";

interface DashboardStatsParams {
  userId?: number;
  isAdmin?: boolean;
  userRole?: Role | null;
}

/**
 * Get dashboard statistics
 * For admin: returns global stats
 * For non-admin: returns user-specific stats
 */
export const getDashboardStats = async ({ userId, isAdmin, userRole }: DashboardStatsParams = {}) => {
  try {
    if (isAdmin) {
      // Admin sees global stats
      const [
        totalUsers,
        activeUsers,
        blockedUsers,
        totalLeads,
        assignedLeadsCount,
        unassignedLeadsCount,
        totalProducts,
        totalCampaigns,
      ] = await Promise.all([
        // Total Users
        User.count(),

        // Active Users
        User.count({
          where: { status: "active" },
        }),

        // Blocked Users
        User.count({
          where: { status: "blocked" },
        }),

        // Total Leads
        Lead.count(),

        // Assigned Leads - count leads where assignees JSON array has at least one item
        Lead.count({
          where: Sequelize.literal("JSON_LENGTH(COALESCE(assignees, '[]')) > 0"),
        }),

        // Unassigned Leads - count leads where assignees is null, empty, or empty array
        Lead.count({
          where: Sequelize.literal("(assignees IS NULL OR assignees = '[]' OR assignees = '' OR JSON_LENGTH(COALESCE(assignees, '[]')) = 0)"),
        }),

        // Total Products (pending status)
        ProductSale.count({
          where: { status: "pending" },
        }),

        // Total Campaigns
        Campaign.count({
          distinct: true,
          col: "campaignName",
        }),
      ]);

      return {
        users: {
          total: totalUsers,
          active: activeUsers,
          blocked: blockedUsers,
        },
        leads: {
          total: totalLeads,
          assigned: assignedLeadsCount,
          unassigned: unassignedLeadsCount,
        },
        products: {
          total: totalProducts,
        },
        campaigns: {
          total: totalCampaigns,
        },
      };
    } else {
      // Non-admin users: get user-specific stats
      if (!userId) {
        throw new Error("UserId is required for non-admin users");
      }

      // Get user's campaign permissions
      const user = await User.findByPk(userId, {
        include: {
          model: Role,
          include: [Permission],
        },
      }) as any;

      if (!user) {
        throw new Error("User not found");
      }

      const permissions = user.Role?.Permissions || [];
      const allowedCampaignIds: number[] = [];
      const allowedCampaignNames: string[] = [];

      // Extract campaign permissions
      permissions.forEach((perm: any) => {
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

      // Get all campaigns to filter by name
      let allowedCampaigns: any[] = [];
      if (allowedCampaignIds.length > 0 || allowedCampaignNames.length > 0) {
        const campaignWhere: any = {
          [Op.or]: [],
        };
        if (allowedCampaignIds.length > 0) {
          campaignWhere[Op.or].push({ id: { [Op.in]: allowedCampaignIds } });
        }
        if (allowedCampaignNames.length > 0) {
          campaignWhere[Op.or].push(
            Sequelize.where(
              Sequelize.fn("LOWER", Sequelize.col("campaignName")),
              { [Op.in]: allowedCampaignNames }
            )
          );
        }
        allowedCampaigns = await Campaign.findAll({ where: campaignWhere });
      } else {
        // Check for general campaign permission
        const hasGeneralPermission = permissions.some((p: any) => p.name === "campaign:get");
        if (hasGeneralPermission) {
          allowedCampaigns = await Campaign.findAll();
        }
      }

      const allowedCampaignNamesList = allowedCampaigns.map((c: any) => c.campaignName?.toLowerCase().trim()).filter(Boolean);

      // My assigned leads (user is in assignees array AND in user's campaigns AND created by user)
      // For datascrapper and non-admin users: only show leads they created
      const myAssignedLeadsCondition = {
        [Op.and]: [
          Sequelize.literal(
            `JSON_CONTAINS(COALESCE(assignees, '[]'), JSON_OBJECT('userId', ${userId}), '$')`
          ),
          { createdBy: userId }, // Filter by creator - only show leads created by this user
          ...(allowedCampaignNamesList.length > 0 ? [{
            campaignName: { [Op.in]: allowedCampaignNamesList },
          }] : []),
        ],
      };
      const myAssignedLeadsCount = allowedCampaignNamesList.length > 0
        ? await Lead.count({
            where: myAssignedLeadsCondition,
          })
        : 0;

      // My unassigned leads (in user's campaigns but not assigned to user AND created by user)
      // For datascrapper and non-admin users: only show leads they created
      const myUnassignedLeadsCondition = {
        [Op.and]: [
          { createdBy: userId }, // Filter by creator - only show leads created by this user
          ...(allowedCampaignNamesList.length > 0 ? [{
            campaignName: { [Op.in]: allowedCampaignNamesList },
          }] : []),
          Sequelize.literal(
            `NOT JSON_CONTAINS(COALESCE(assignees, '[]'), JSON_OBJECT('userId', ${userId}), '$')`
          ),
          Sequelize.literal(
            `(assignees IS NULL OR assignees = '[]' OR assignees = '' OR JSON_LENGTH(COALESCE(assignees, '[]')) = 0)`
          ),
        ],
      };
      const myUnassignedLeadsCount = allowedCampaignNamesList.length > 0
        ? await Lead.count({
            where: myUnassignedLeadsCondition,
          })
        : 0;

      // Total leads in user's campaigns (only leads created by user)
      // For datascrapper and non-admin users: only show leads they created
      const myTotalLeadsCount = allowedCampaignNamesList.length > 0
        ? await Lead.count({
            where: {
              campaignName: { [Op.in]: allowedCampaignNamesList },
              createdBy: userId, // Filter by creator - only show leads created by this user
            },
          })
        : 0;

      // My sales (products assigned to user or created by user)
      const mySalesCount = await ProductSale.count({
        where: {
          [Op.or]: [
            { assigneeId: userId },
            { createdBy: userId },
          ],
        },
      });

      // My products (products assigned to user)
      const myProductsCount = await ProductSale.count({
        where: { assigneeId: userId },
      });

      // My campaigns (campaigns user has access to)
      const myCampaignsCount = allowedCampaigns.length;

      return {
        users: {
          total: 0, // Not shown for non-admin
          active: 0,
          blocked: 0,
        },
        leads: {
          total: myTotalLeadsCount,
          assigned: myAssignedLeadsCount,
          unassigned: myUnassignedLeadsCount,
        },
        products: {
          total: myProductsCount,
        },
        sales: {
          total: mySalesCount,
        },
        campaigns: {
          total: myCampaignsCount,
        },
      };
    }
  } catch (error: any) {
    throw new Error(`Error fetching dashboard stats: ${error.message}`);
  }
};

