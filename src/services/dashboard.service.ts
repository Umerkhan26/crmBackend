import User from "../models/user.model";
import Lead from "../models/lead.model";
import ProductSale from "../models/product.model";
import Campaign from "../models/campaign.model";
import Role from "../models/role.model";
import Permission from "../models/permission.model";
import Note from "../models/note.model";
import LeadActivity from "../models/leadActivity.model";
import { Op, Sequelize, QueryTypes } from "sequelize";
import db from "../../db";

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
        leadsWithWorkResult,
        totalSales,
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

        // Leads with Work Done - count distinct leads that have notes or activities
        // Use a raw query to count leads with work
        db.query(
          `SELECT COUNT(DISTINCT l.id) as count
           FROM leads l
           WHERE EXISTS (
             SELECT 1 FROM notes n 
             WHERE n.notebleId = l.id AND n.notebleType = 'lead'
           ) OR EXISTS (
             SELECT 1 FROM lead_activities la 
             WHERE la.entityId = l.id AND la.entityType = 'lead'
           )`,
          { type: QueryTypes.SELECT }
        ) as Promise<any[]>,

        // Total Sales - count all converted sales
        ProductSale.count({
          where: { status: "converted" },
        }),
      ]);

      // Extract count from raw query result
      const leadsWithWorkCount = (leadsWithWorkResult[0] as any)?.count || 0;

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
          withWork: leadsWithWorkCount, // Admin only: leads with work done
        },
        products: {
          total: totalProducts,
        },
        sales: {
          total: totalSales,
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

      // My assigned leads (user is in assignees array AND in user's campaigns)
      // Show all leads assigned to this user, regardless of who created them
      const myAssignedLeadsCondition = {
        [Op.and]: [
          Sequelize.literal(
            `JSON_CONTAINS(COALESCE(assignees, '[]'), JSON_OBJECT('userId', ${userId}), '$')`
          ),
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

      // Check if user has permission to create leads (for showing creator stats)
      const hasLeadCreatePermission = permissions.some((p: any) => p.name === "lead:create");
      
      let myCreatedLeadsAssignedCount = 0;
      let myCreatedLeadsConvertedToSalesCount = 0;

      if (hasLeadCreatePermission) {
        // Count leads created by user that are assigned to others
        // (leads have assignees but creator is not in assignees, or assignees exist and don't include creator)
        const myCreatedLeadsAssignedCondition = {
          [Op.and]: [
            { createdBy: userId },
            Sequelize.literal("JSON_LENGTH(COALESCE(assignees, '[]')) > 0"),
            Sequelize.literal(
              `NOT JSON_CONTAINS(COALESCE(assignees, '[]'), JSON_OBJECT('userId', ${userId}), '$')`
            ),
          ],
        };
        myCreatedLeadsAssignedCount = await Lead.count({
          where: myCreatedLeadsAssignedCondition,
        });

        // Count leads created by user that are converted to sales
        // Find all leads created by user, then count ProductSales with matching leadId
        const myCreatedLeads = await Lead.findAll({
          where: { createdBy: userId },
          attributes: ["id"],
        });
        const myCreatedLeadIds = myCreatedLeads.map((l: any) => l.id);
        
        if (myCreatedLeadIds.length > 0) {
          myCreatedLeadsConvertedToSalesCount = await ProductSale.count({
            where: {
              leadId: { [Op.in]: myCreatedLeadIds },
            },
          });
        }
      }

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
          // Stats for leads created by user (only if user has lead:create permission)
          createdByMe: {
            assignedToOthers: myCreatedLeadsAssignedCount,
            convertedToSales: myCreatedLeadsConvertedToSalesCount,
          },
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

