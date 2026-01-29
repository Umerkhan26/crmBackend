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
import { buildDateFilter, FilterType } from "../utils/dateFilters";

interface DashboardStatsParams {
  userId?: number;
  isAdmin?: boolean;
  userRole?: Role | null;
  filterType?: FilterType;
  startDate?: string;
  endDate?: string;
}

/**
 * Get dashboard statistics
 * For admin: returns global stats
 * For non-admin: returns user-specific stats
 * Date filters (if provided) are applied to time-based entities like leads,
 * products and sales. User counts remain global (not date-filtered).
 */
export const getDashboardStats = async ({
  userId,
  isAdmin,
  userRole,
  filterType = "",
  startDate,
  endDate,
}: DashboardStatsParams = {}) => {
  try {
    const dateFilter =
      filterType && filterType.trim() !== ""
        ? buildDateFilter(filterType, startDate, endDate)
        : {};
    const dateWhereClause = dateFilter && Object.keys(dateFilter).length > 0 ? dateFilter : {};

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
        // Total Users (not date-filtered)
        User.count(),

        // Active Users (not date-filtered)
        User.count({
          where: { status: "active" },
        }),

        // Blocked Users (not date-filtered)
        User.count({
          where: { status: "blocked" },
        }),

        // Total Leads (optionally date-filtered)
        Lead.count({
          where: dateWhereClause as any,
        }),

        // Assigned Leads - count leads where assignees JSON array has at least one item
        Lead.count({
          where: {
            ...dateWhereClause,
            [Op.and]: Sequelize.literal(
              "JSON_LENGTH(COALESCE(assignees, '[]')) > 0"
            ),
          } as any,
        }),

        // Unassigned Leads - count leads where assignees is null, empty, or empty array
        Lead.count({
          where: {
            ...dateWhereClause,
            [Op.and]: Sequelize.literal(
              "(assignees IS NULL OR assignees = '[]' OR assignees = '' OR JSON_LENGTH(COALESCE(assignees, '[]')) = 0)"
            ),
          } as any,
        }),

        // Total Products (pending status, optionally date-filtered)
        ProductSale.count({
          where: {
            status: "pending",
            ...dateWhereClause,
          } as any,
        }),

        // Total Campaigns (optionally date-filtered by creation date)
        Campaign.count({
          distinct: true,
          col: "campaignName",
          where: dateWhereClause as any,
        }),

        // Leads with Work Done - count distinct leads that have notes or activities.
        // We apply the same createdAt filter on leads if provided.
        (() => {
          const hasDateFilter = dateWhereClause && (dateWhereClause as any).createdAt;
          const dateCondition = hasDateFilter && (dateWhereClause as any).createdAt[Op.between]
            ? "l.createdAt BETWEEN :start AND :end AND "
            : "";
          return db.query(
            `SELECT COUNT(DISTINCT l.id) as count
             FROM leads l
             WHERE ${dateCondition}(
               EXISTS (
                 SELECT 1 FROM notes n 
                 WHERE n.notebleId = l.id AND n.notebleType = 'lead'
               ) OR EXISTS (
                 SELECT 1 FROM lead_activities la 
                 WHERE la.entityId = l.id AND la.entityType = 'lead'
               )
             )`,
            {
              type: QueryTypes.SELECT,
              replacements:
                hasDateFilter && (dateWhereClause as any).createdAt[Op.between]
                  ? {
                      start: (dateWhereClause as any).createdAt[Op.between][0],
                      end: (dateWhereClause as any).createdAt[Op.between][1],
                    }
                  : {},
            }
          ) as Promise<any[]>;
        })(),

        // Total Sales - count all converted sales (optionally date-filtered)
        ProductSale.count({
          where: {
            status: "converted",
            ...dateWhereClause,
          } as any,
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
          ...(Object.keys(dateWhereClause).length > 0 ? [dateWhereClause] : []),
        ],
      };
      const myAssignedLeadsCount = allowedCampaignNamesList.length > 0
        ? await Lead.count({
            where: myAssignedLeadsCondition as any,
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
          ...(Object.keys(dateWhereClause).length > 0 ? [dateWhereClause] : []),
        ],
      };
      const myUnassignedLeadsCount = allowedCampaignNamesList.length > 0
        ? await Lead.count({
            where: myUnassignedLeadsCondition as any,
          })
        : 0;

      // Total leads in user's campaigns (only leads created by user)
      // For datascrapper and non-admin users: only show leads they created
      const myTotalLeadsCount = allowedCampaignNamesList.length > 0
        ? await Lead.count({
            where: {
              campaignName: { [Op.in]: allowedCampaignNamesList },
              createdBy: userId, // Filter by creator - only show leads created by this user
              ...dateWhereClause,
            } as any,
          })
        : 0;

      // My sales (products assigned to user or created by user)
      const mySalesCount = await ProductSale.count({
        where: {
          [Op.or]: [
            { assigneeId: userId },
            { createdBy: userId },
          ],
          ...dateWhereClause,
        } as any,
      });

      // My products (products assigned to user)
      const myProductsCount = await ProductSale.count({
        where: {
          assigneeId: userId,
          ...dateWhereClause,
        } as any,
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
            ...(Object.keys(dateWhereClause).length > 0 ? [dateWhereClause] : []),
          ],
        };
        myCreatedLeadsAssignedCount = await Lead.count({
          where: myCreatedLeadsAssignedCondition as any,
        });

        // Count leads created by user that are converted to sales
        // Find all leads created by user, then count ProductSales with matching leadId
        const myCreatedLeads = await Lead.findAll({
          where: {
            createdBy: userId,
            ...dateWhereClause,
          } as any,
          attributes: ["id"],
        });
        const myCreatedLeadIds = myCreatedLeads.map((l: any) => l.id);
        
        if (myCreatedLeadIds.length > 0) {
          myCreatedLeadsConvertedToSalesCount = await ProductSale.count({
            where: {
              leadId: { [Op.in]: myCreatedLeadIds },
              ...dateWhereClause,
            } as any,
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

