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
import { getManagerBrandUserIds } from "../utils/brandUtils";
import { PERMISSIONS } from "../constants/permissions";
// Notes are loaded via a separate endpoint for performance.

interface DashboardStatsParams {
  userId?: number;
  isAdmin?: boolean;
  isManager?: boolean;
  userRole?: Role | null;
  filterType?: FilterType;
  startDate?: string;
  endDate?: string;
  notesPage?: number;
  notesLimit?: number;
}

const buildCreatedAtBetween = (dateWhereClause: any): [Date, Date] | null => {
  const range = dateWhereClause?.createdAt?.[Op.between];
  if (!Array.isArray(range) || range.length !== 2) return null;
  return [range[0], range[1]];
};

const getMasterLeadIndexCounts = async (dateWhereClause: any) => {
  const dateBetween = buildCreatedAtBetween(dateWhereClause);
  const createdAtSql = dateBetween ? " AND createdAt BETWEEN :start AND :end " : "";
  const replacements = dateBetween
    ? { start: dateBetween[0], end: dateBetween[1] }
    : {};

  const rows = (await db.query(
    `
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN JSON_LENGTH(COALESCE(assignees, '[]')) > 0 THEN 1 ELSE 0 END) AS assigned,
        SUM(CASE WHEN JSON_LENGTH(COALESCE(assignees, '[]')) = 0 THEN 1 ELSE 0 END) AS unassigned
      FROM leads
      WHERE 1=1
      ${createdAtSql}
    `,
    { type: QueryTypes.SELECT, replacements },
  )) as any[];

  const total = Number(rows?.[0]?.total || 0);
  const assigned = Number(rows?.[0]?.assigned || 0);
  const unassigned = Number(rows?.[0]?.unassigned || 0);

  return {
    total,
    assigned,
    unassigned,
  };
};

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
  isManager,
  userRole,
  filterType = "",
  startDate,
  endDate,
  notesPage = 1,
  notesLimit = 5,
}: DashboardStatsParams = {}) => {
  try {
    const dateFilter =
      filterType && filterType.trim() !== ""
        ? buildDateFilter(filterType, startDate, endDate)
        : {};
    const dateWhereClause =
      dateFilter && Object.keys(dateFilter).length > 0 ? dateFilter : {};

    if (isAdmin) {
      const masterLeadCounts = await getMasterLeadIndexCounts(dateWhereClause);
      // Admin sees global stats
      const [
        totalUsers,
        activeUsers,
        blockedUsers,
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
        // (() => {
        //   const hasDateFilter =
        //     dateWhereClause && (dateWhereClause as any).createdAt;
        //   const dateCondition =
        //     hasDateFilter && (dateWhereClause as any).createdAt[Op.between]
        //       ? "l.createdAt BETWEEN :start AND :end AND "
        //       : "";
        //   return db.query(
        //     `SELECT COUNT(DISTINCT l.id) as count
        //      FROM leads l
        //      WHERE ${dateCondition}(
        //        EXISTS (
        //          SELECT 1 FROM notes n
        //          WHERE n.notebleId = l.id AND n.notebleType = 'lead'
        //        ) OR EXISTS (
        //          SELECT 1 FROM lead_activities la
        //          WHERE la.entityId = l.id AND la.entityType = 'lead'
        //        )
        //      )`,
        //     {
        //       type: QueryTypes.SELECT,
        //       replacements:
        //         hasDateFilter && (dateWhereClause as any).createdAt[Op.between]
        //           ? {
        //               start: (dateWhereClause as any).createdAt[Op.between][0],
        //               end: (dateWhereClause as any).createdAt[Op.between][1],
        //             }
        //           : {},
        //     },
        //   ) as Promise<any[]>;
        // })(),
        // Promise.resolve([{ count: 0 }]),
        // Total Sales - count all converted sales (optionally date-filtered)

        db.query(
          `
  SELECT COUNT(DISTINCT l.id) AS count
  FROM leads l
  LEFT JOIN lead_activities la 
    ON la.entityId = l.id AND la.entityType = 'lead'
  LEFT JOIN notes n 
    ON n.notebleId = l.id AND n.notebleType = 'lead'
  WHERE la.id IS NOT NULL OR n.id IS NOT NULL
  ${(dateWhereClause as any).createdAt?.[Op.between] ? "AND l.createdAt BETWEEN :start AND :end" : ""}
  `,
          {
            type: QueryTypes.SELECT,
            replacements: (dateWhereClause as any).createdAt?.[Op.between]
              ? {
                  start: (dateWhereClause as any).createdAt[Op.between][0],
                  end: (dateWhereClause as any).createdAt[Op.between][1],
                }
              : {},
          },
        ),
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
          total: masterLeadCounts.total,
          assigned: masterLeadCounts.assigned,
          unassigned: masterLeadCounts.unassigned,
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
        // recentNotes: {
        //   notes: [],
        //   totalPages: 0,
        //   currentPage: notesPage,
        //   totalRecords: 0,
        //   pageSize: notesLimit,
        // },
      };
    } else if (isManager && userId) {
      const masterLeadCounts = await getMasterLeadIndexCounts(dateWhereClause);
      // Manager: Users + LeadsWithWork = brand-scoped; rest = admin/master (global)
      const brandUserIds = await getManagerBrandUserIds(userId);
      const brandUserIdsList =
        brandUserIds.length > 0 ? brandUserIds.join(",") : "0";

      const [
        totalUsers,
        activeUsers,
        blockedUsers,
        totalProducts,
        totalCampaigns,
        leadsWithWorkResult,
        totalSales,
      ] = await Promise.all([
        // Users: only manager's brand users
        User.count({
          where:
            brandUserIds.length > 0
              ? { id: { [Op.in]: brandUserIds } }
              : { id: -1 },
        }),
        User.count({
          where:
            brandUserIds.length > 0
              ? { id: { [Op.in]: brandUserIds }, status: "active" }
              : { id: -1 },
        }),
        User.count({
          where:
            brandUserIds.length > 0
              ? { id: { [Op.in]: brandUserIds }, status: "blocked" }
              : { id: -1 },
        }),
        // Products: admin view
        ProductSale.count({
          where: { status: "pending", ...dateWhereClause } as any,
        }),
        // Campaigns: admin view
        Campaign.count({
          distinct: true,
          col: "campaignName",
          where: dateWhereClause as any,
        }),
        // Leads with Work: only leads where work (notes/activities) done by manager's users
        brandUserIds.length > 0
          ? db.query(
              `SELECT COUNT(DISTINCT l.id) AS count FROM leads l
               WHERE (
                 EXISTS (SELECT 1 FROM notes n WHERE n.notebleId = l.id AND n.notebleType = 'lead' AND n.createdBy IN (${brandUserIdsList}))
                 OR EXISTS (SELECT 1 FROM lead_activities la WHERE la.entityId = l.id AND la.entityType = 'lead' AND la.performedBy IN (${brandUserIdsList}))
               )
               ${(dateWhereClause as any).createdAt?.[Op.between] ? "AND l.createdAt BETWEEN :start AND :end" : ""}`,
              {
                type: QueryTypes.SELECT,
                replacements: (dateWhereClause as any).createdAt?.[Op.between]
                  ? {
                      start: (dateWhereClause as any).createdAt[Op.between][0],
                      end: (dateWhereClause as any).createdAt[Op.between][1],
                    }
                  : {},
              },
            )
          : Promise.resolve([{ count: 0 }]),
        // Sales: admin view
        ProductSale.count({
          where: { status: "converted", ...dateWhereClause } as any,
        }),
      ]);

      const leadsWithWorkCount = (leadsWithWorkResult[0] as any)?.count || 0;

      return {
        users: {
          total: totalUsers,
          active: activeUsers,
          blocked: blockedUsers,
        },
        leads: {
          total: masterLeadCounts.total,
          assigned: masterLeadCounts.assigned,
          unassigned: masterLeadCounts.unassigned,
          withWork: leadsWithWorkCount,
        },
        products: { total: totalProducts },
        sales: { total: totalSales },
        campaigns: { total: totalCampaigns },
      };
    } else {
      // Non-admin users: get user-specific stats
      if (!userId) {
        throw new Error("UserId is required for non-admin users");
      }

      // Get user's campaign permissions
      const user = (await User.findByPk(userId, {
        include: {
          model: Role,
          include: [Permission],
        },
      })) as any;

      if (!user) {
        throw new Error("User not found");
      }

      const permissions = user.Role?.Permissions || [];
      const allowedCampaignIds: number[] = [];
      const allowedCampaignNames: string[] = [];

      // Extract campaign permissions
      permissions.forEach((perm: any) => {
        if (
          perm.name === "getCampaignById" &&
          perm.resourceId &&
          !isNaN(Number(perm.resourceId))
        ) {
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
              { [Op.in]: allowedCampaignNames },
            ),
          );
        }
        allowedCampaigns = await Campaign.findAll({ where: campaignWhere });
      } else {
        // Check for general campaign permission
        const hasGeneralPermission = permissions.some(
          (p: any) => p.name === "campaign:get",
        );
        if (hasGeneralPermission) {
          allowedCampaigns = await Campaign.findAll();
        }
      }

      const allowedCampaignNamesList = allowedCampaigns
        .map((c: any) => c.campaignName?.toLowerCase().trim())
        .filter(Boolean);

      // My assigned leads (user is in assignees array AND in user's campaigns)
      // Show all leads assigned to this user, regardless of who created them
      const myAssignedLeadsCondition = {
        [Op.and]: [
          Sequelize.literal(
            `JSON_CONTAINS(COALESCE(assignees, '[]'), JSON_OBJECT('userId', ${userId}), '$')`,
          ),
          ...(allowedCampaignNamesList.length > 0
            ? [
                {
                  campaignName: { [Op.in]: allowedCampaignNamesList },
                },
              ]
            : []),
          ...(Object.keys(dateWhereClause).length > 0 ? [dateWhereClause] : []),
        ],
      };
      const myAssignedLeadsCount =
        allowedCampaignNamesList.length > 0
          ? await Lead.count({
              where: myAssignedLeadsCondition as any,
            })
          : 0;

      // My unassigned leads (in user's campaigns but not assigned to user AND created by user)
      // For datascrapper and non-admin users: only show leads they created
      const myUnassignedLeadsCondition = {
        [Op.and]: [
          { createdBy: userId }, // Filter by creator - only show leads created by this user
          ...(allowedCampaignNamesList.length > 0
            ? [
                {
                  campaignName: { [Op.in]: allowedCampaignNamesList },
                },
              ]
            : []),
          Sequelize.literal(
            `NOT JSON_CONTAINS(COALESCE(assignees, '[]'), JSON_OBJECT('userId', ${userId}), '$')`,
          ),
          Sequelize.literal(
            `(assignees IS NULL OR assignees = '[]' OR assignees = '' OR JSON_LENGTH(COALESCE(assignees, '[]')) = 0)`,
          ),
          ...(Object.keys(dateWhereClause).length > 0 ? [dateWhereClause] : []),
        ],
      };
      const myUnassignedLeadsCount =
        allowedCampaignNamesList.length > 0
          ? await Lead.count({
              where: myUnassignedLeadsCondition as any,
            })
          : 0;

      // Total leads in user's campaigns (only leads created by user)
      // For datascrapper and non-admin users: only show leads they created
      const myTotalLeadsCount =
        allowedCampaignNamesList.length > 0
          ? await Lead.count({
              where: {
                campaignName: { [Op.in]: allowedCampaignNamesList },
                createdBy: userId, // Filter by creator - only show leads created by this user
                ...dateWhereClause,
              } as any,
            })
          : 0;

      // Check product/sale permissions - show 0 if user lacks permission
      const hasProductPermission = permissions.some(
        (p: any) =>
          p.name === PERMISSIONS.PRODUCT_GET_ALL ||
          p.name === PERMISSIONS.PRODUCT_GET_BY_ID,
      );
      const hasSalePermission = permissions.some(
        (p: any) =>
          p.name === PERMISSIONS.SALE_GET_ALL ||
          p.name === PERMISSIONS.SALE_GET_BY_ID ||
          p.name === PERMISSIONS.SALE_GET_BY_ASSIGNEE,
      );

      // My sales (products assigned to user or created by user) - 0 if no sale permission
      const mySalesCount = hasSalePermission
        ? await ProductSale.count({
            where: {
              [Op.or]: [{ assigneeId: userId }, { createdBy: userId }],
              ...dateWhereClause,
            } as any,
          })
        : 0;

      // My products (products assigned to user) - 0 if no product permission
      const myProductsCount = hasProductPermission
        ? await ProductSale.count({
            where: {
              assigneeId: userId,
              ...dateWhereClause,
            } as any,
          })
        : 0;

      // My campaigns (campaigns user has access to)
      const myCampaignsCount = allowedCampaigns.length;

      // Check if user has permission to create leads (for showing creator stats)
      const hasLeadCreatePermission = permissions.some(
        (p: any) => p.name === "lead:create",
      );

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
              `NOT JSON_CONTAINS(COALESCE(assignees, '[]'), JSON_OBJECT('userId', ${userId}), '$')`,
            ),
            ...(Object.keys(dateWhereClause).length > 0
              ? [dateWhereClause]
              : []),
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
        recentNotes: {
          notes: [],
          totalPages: 0,
          currentPage: notesPage,
          totalRecords: 0,
          pageSize: notesLimit,
        },
      };
    }
  } catch (error: any) {
    throw new Error(`Error fetching dashboard stats: ${error.message}`);
  }
};
