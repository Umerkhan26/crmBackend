import { literal, Op, Sequelize, where, fn, col } from "sequelize";
import Lead, {
  AssigneeWithStatus,
  LeadAttributes,
  LeadCreationAttributes,
} from "../models/lead.model";
import { buildSearchFilter } from "../utils/filterQuery";
import { getPagination, getPagingData } from "../utils/paginate";
import { logActivity } from "./activity.service";
import { sendNotification } from "./notification.service";
import User from "../models/user.model";
import { checkEmailPermission } from "./email.service";
import EmailTemplate from "../models/emailTemplate.model";
import { getSmtpConfig } from "../utils/getSmtpConfig";
import { sendEmail } from "../utils/email";
import { logEmailStatus } from "./emailLog.service";
import { UserAttributes } from "../interfaces/user.interface";
import { buildDateFilter, FilterType } from "../utils/dateFilters";
import { logLeadActivity } from "../utils/logLeadActivity";
import Campaign from "../models/campaign.model";

interface PaginationParams {
  page?: number;
  limit?: number;
}
interface LeadQueryParams extends PaginationParams {
  filters?: Record<string, any>;
  search?: string;
}
// Create Lead
export const createLead = async (
  data: LeadCreationAttributes,
  userId?: number
): Promise<LeadAttributes & { leadCode: string }> => {
  try {
    const lead = await Lead.create(data);

    if (userId) {
      await logActivity(userId, "create", `Lead created with ID ${lead.id}`);
      await sendNotification(userId, `New lead created with ID ${lead.id}`);
    }

    return { ...lead.get(), leadCode: lead.leadCode };
  } catch (error: any) {
    throw new Error(`Error creating lead: ${error.message}`);
  }
};

export const getAllLeads = async ({
  page = 1,
  limit = 10,
  filters = {},
  search = "",
  filterType,
  startDate,
  endDate,
}: {
  page?: number;
  limit?: number;
  filters?: any;
  search?: string;
  filterType?: FilterType;
  startDate?: string;
  endDate?: string;
}) => {
  try {
    const { offset, limit: pageLimit } = getPagination({ page, limit });

    const whereCondition: any = { ...filters };

    // ⏳ Inject date filter (createdAt)
    if (filterType) {
      const dateFilter = buildDateFilter(filterType, startDate, endDate);
      Object.assign(whereCondition, dateFilter);
    }

    // 🔍 JSON Search
    const searchCondition = search
      ? {
        [Op.or]: [
          Sequelize.literal(
            `JSON_UNQUOTE(JSON_EXTRACT(leadData, '$.first_name')) LIKE '%${search}%'`
          ),
          Sequelize.literal(
            `JSON_UNQUOTE(JSON_EXTRACT(leadData, '$.last_name')) LIKE '%${search}%'`
          ),
          Sequelize.literal(
            `JSON_UNQUOTE(JSON_EXTRACT(leadData, '$.agent_name')) LIKE '%${search}%'`
          ),
          Sequelize.literal(
            `JSON_UNQUOTE(JSON_EXTRACT(leadData, '$.phone_number')) LIKE '%${search}%'`
          ),
          Sequelize.literal(
            `JSON_UNQUOTE(JSON_EXTRACT(leadData, '$.state')) LIKE '%${search}%'`
          ),
        ],
      }
      : {};

    // 🚀 Fetch leads
    const leadsData = await Lead.findAndCountAll({
      offset,
      limit: pageLimit,
      where: {
        ...whereCondition,
        ...(search ? { [Op.and]: searchCondition } : {}),
      },
      order: [["createdAt", "DESC"]],
    });

    // 🔗 Enrich assignees with user details
    const rowsWithAssignees = await Promise.all(
      leadsData.rows.map(async (lead) => {
        let assigneesRaw: AssigneeWithStatus[] = [];

        // Parse assignees
        if (typeof lead.assignees === "string") {
          try {
            assigneesRaw = JSON.parse(lead.assignees) as AssigneeWithStatus[];
          } catch {
            assigneesRaw = [];
          }
        } else if (Array.isArray(lead.assignees)) {
          assigneesRaw = lead.assignees;
        }

        const userIds = assigneesRaw
          .map((a) => a.userId)
          .filter((id): id is number => typeof id === "number");

        let assigneesData: any[] = [];

        if (userIds.length > 0) {
          const users = await User.findAll({
            where: { id: userIds },
            attributes: ["id", "firstname", "lastname", "email"],
          });

          assigneesData = users.map((user) => {
            const assignment = assigneesRaw.find((a) => a.userId === user.id);
            return {
              ...user.toJSON(),
              status: assignment?.status || "pending",
            };
          });
        }

        return { ...lead.toJSON(), assignees: assigneesData };
      })
    );

    // ✅ Return paginated + enriched data
    return getPagingData(
      { count: leadsData.count, rows: rowsWithAssignees },
      page,
      pageLimit
    );
  } catch (error: any) {
    throw new Error(`Error fetching leads: ${error.message}`);
  }
};
export const getLeadById = async (leadId: number): Promise<LeadAttributes> => {
  try {
    const lead = await Lead.findByPk(leadId);

    if (!lead) {
      throw new Error(`Lead not found with ID ${leadId}`);
    }

    // 🧩 Enrich assignee details (same logic as getAllLeads)
    let assigneesRaw: AssigneeWithStatus[] = [];

    if (typeof lead.assignees === "string") {
      try {
        assigneesRaw = JSON.parse(lead.assignees) as AssigneeWithStatus[];
      } catch {
        assigneesRaw = [];
      }
    } else if (Array.isArray(lead.assignees)) {
      assigneesRaw = lead.assignees;
    }

    const userIds = assigneesRaw
      .map((a) => a.userId)
      .filter((id): id is number => typeof id === "number");

    let assigneesData: any[] = [];

    if (userIds.length > 0) {
      const users = await User.findAll({
        where: { id: userIds },
        attributes: ["id", "firstname", "lastname", "email"],
      });

      assigneesData = users.map((user) => {
        const assignment = assigneesRaw.find((a) => a.userId === user.id);
        return {
          ...user.toJSON(),
          status: assignment?.status || "pending",
        };
      });
    }

    return {
      ...lead.toJSON(),
      assignees: assigneesData,
    };
  } catch (error: any) {
    throw new Error(`Error fetching lead by ID: ${error.message}`);
  }
};

interface GetLeadsByCampaignParams {
  campaignName: string;
  page?: number;
  limit?: number;
}

export const getLeadsByCampaign = async ({
  campaignName,
  page = 1,
  limit = 10,
}: GetLeadsByCampaignParams): Promise<any> => {
  try {
    const { offset, limit: paginationLimit } = getPagination({ page, limit });

    // 🧠 Fetch paginated leads for the given campaign
    const leads = await Lead.findAndCountAll({
      where: { campaignName },
      order: [["createdAt", "DESC"]],
      offset,
      limit: paginationLimit,
    });

    // 🔗 Enrich each lead with assignee user details
    const enrichedLeads = await Promise.all(
      leads.rows.map(async (lead) => {
        let assigneesRaw: AssigneeWithStatus[] = [];

        // Normalize `assignees`
        if (typeof lead.assignees === "string") {
          try {
            assigneesRaw = JSON.parse(lead.assignees) as AssigneeWithStatus[];
          } catch {
            assigneesRaw = [];
          }
        } else if (Array.isArray(lead.assignees)) {
          assigneesRaw = lead.assignees;
        } else if (
          typeof lead.assignees === "object" &&
          lead.assignees !== null
        ) {
          assigneesRaw = [lead.assignees];
        }

        // Extract valid user IDs
        const userIds = assigneesRaw
          .map((a) => a.userId)
          .filter((id): id is number => typeof id === "number");

        let assigneesData: any[] = [];

        if (userIds.length > 0) {
          const users = await User.findAll({
            where: { id: userIds },
            attributes: ["id", "firstname", "lastname", "email"],
          });

          assigneesData = users.map((user) => {
            const assignment = assigneesRaw.find((a) => a.userId === user.id);
            return {
              ...user.toJSON(),
              status: assignment?.status || "pending",
            };
          });
        }

        return { ...lead.toJSON(), assignees: assigneesData };
      })
    );

    // 📦 Format and return paginated data
    const response = getPagingData(
      { count: leads.count, rows: enrichedLeads },
      page,
      limit
    );

    return response;
  } catch (error: any) {
    throw new Error(
      `Error fetching leads for campaign ${campaignName}: ${error.message}`
    );
  }
};

// Update Lead
export const updateLead = async (
  id: number,
  updatedData: Partial<LeadCreationAttributes>,
  userId?: number
): Promise<LeadAttributes> => {
  try {
    const lead = await Lead.findByPk(id);
    if (!lead) {
      throw new Error("Lead not found");
    }

    await lead.update(updatedData);

    if (userId) {
      await logActivity(userId, "update", `Lead updated with ID ${lead.id}`);
      await sendNotification(userId, `Lead updated with ID ${lead.id}`);
    }

    return { ...(lead.toJSON() as any) }; // ensures leadCode is included
  } catch (error: any) {
    throw new Error(`Error updating lead: ${error.message}`);
  }
};

// Delete Lead
export const deleteLead = async (
  id: number,
  userId?: number
): Promise<void> => {
  try {
    const lead = await Lead.findByPk(id);
    if (!lead) {
      throw new Error("Lead not found");
    }

    await lead.destroy();

    if (userId) {
      await logActivity(userId, "delete", `Lead deleted with ID ${id}`);
      await sendNotification(userId, `Lead deleted with ID ${id}`);
    }
  } catch (error: any) {
    throw new Error(`Error deleting lead: ${error.message}`);
  }
};

export const assignLeadToUsers = async (
  leadId: number,
  userIdsToAssign: number[],
  assignedByUserId?: number
): Promise<LeadAttributes> => {
  try {
    const lead = await Lead.findByPk(leadId);
    if (!lead) {
      throw new Error("Lead not found");
    }

    let currentAssignees: AssigneeWithStatus[] = [];

    // Parse existing assignees from DB
    if (typeof lead.assignees === "string") {
      try {
        currentAssignees = JSON.parse(lead.assignees);
      } catch {
        currentAssignees = [];
      }
    } else if (Array.isArray(lead.assignees)) {
      currentAssignees = lead.assignees as AssigneeWithStatus[];
    }

    // Create set of existing user IDs
    const existingIds = new Set<number>(currentAssignees.map((a) => a.userId));

    // ✅ ADDED: Current timestamp for assignment
    const assignmentTimestamp = new Date().toISOString();

    // Prepare new assignees (only those not already assigned)
    const newAssignees: AssigneeWithStatus[] = userIdsToAssign
      .filter((id: number) => !existingIds.has(id))
      .map((id: number) => ({
        userId: id,
        status: "pending",
        assignedAt: assignmentTimestamp, // ✅ ADDED: Track assignment date
        status_updated: false,
      }));

    if (newAssignees.length === 0) {
      throw new Error("All provided users are already assigned to this lead.");
    }

    // Merge old + new assignments
    const updatedAssignees = [...currentAssignees, ...newAssignees];

    // Save in DB in a single update
    await lead.update({ assignees: updatedAssignees });

    // Log and notify new assignees
    if (assignedByUserId) {
      for (const newUser of newAssignees) {
        await logActivity(
          assignedByUserId,
          "assign",
          `Lead ID ${leadId} assigned to user ID ${newUser.userId}`
        );

        await sendNotification(
          newUser.userId,
          `You have been assigned a new lead (ID: ${leadId})`
        );
      }
    }

    return { ...(lead.toJSON() as any) }; // ensures leadCode is included

    // return lead.get();
  } catch (error: any) {
    throw new Error(`Error assigning lead: ${error.message}`);
  }
};
interface GetAllLeadsParams {
  page?: number;
  limit?: number;
  search?: string;
}

export const getAllLeadsWithAssignee = async ({
  page = 1,
  limit = 10,
  search = "",
  campaign, // ✅ NEW: Campaign filter parameter
  filterType,
  startDate,
  endDate,
}: {
  page?: number;
  limit?: number;
  search?: string;
  campaign?: string; // ✅ NEW
  filterType?: FilterType;
  startDate?: string;
  endDate?: string;
}) => {
  try {
    const { offset, limit: paginationLimit } = getPagination({ page, limit });

    // ✅ Base condition: only leads that have at least one assignee
    const baseCondition = Sequelize.literal("JSON_LENGTH(assignees) > 0");

    const whereConditions: any = {
      [Op.and]: [baseCondition],
    };

    // ✅ NEW: Add campaign filter if provided
    if (campaign && campaign.trim() !== "") {
      const campaignCondition = {
        campaignName: { [Op.like]: `%${campaign.trim()}%` },
      };
      whereConditions[Op.and].push(campaignCondition);
    }

    // ✅ Apply date filter (like in getAllLeads)
    if (filterType) {
      const dateFilter = buildDateFilter(filterType, startDate, endDate);
      whereConditions[Op.and].push(dateFilter);
    }

    // 🔍 Search support (case-insensitive)
    if (search && search.trim() !== "") {
      const s = `%${search.trim().toLowerCase()}%`;

      const jsonSearchCondition = Sequelize.literal(`
        (
          LOWER(JSON_UNQUOTE(JSON_EXTRACT(leadData, '$.agent_name'))) LIKE '${s}'
          OR LOWER(JSON_UNQUOTE(JSON_EXTRACT(leadData, '$.first_name'))) LIKE '${s}'
          OR LOWER(JSON_UNQUOTE(JSON_EXTRACT(leadData, '$.last_name'))) LIKE '${s}'
          OR LOWER(JSON_UNQUOTE(JSON_EXTRACT(leadData, '$.phone_number'))) LIKE '${s}'
          OR LOWER(JSON_UNQUOTE(JSON_EXTRACT(leadData, '$.state'))) LIKE '${s}'
          OR LOWER(JSON_UNQUOTE(JSON_EXTRACT(leadData, '$.email'))) LIKE '${s}'
        )
      `);

      whereConditions[Op.and].push({
        [Op.or]: [{ campaignName: { [Op.like]: s } }, jsonSearchCondition],
      });
    }

    // 🚀 Fetch paginated leads
    const leads = await Lead.findAndCountAll({
      where: whereConditions,
      order: [["createdAt", "DESC"]],
      offset,
      limit: paginationLimit,
    });

    // 🧩 Enrich with user details
    const enrichedLeads = await Promise.all(
      leads.rows.map(async (lead: any) => {
        let assigneesRaw: any[] = [];

        if (lead.assignees) {
          try {
            const parsed =
              typeof lead.assignees === "string"
                ? JSON.parse(lead.assignees)
                : lead.assignees;
            assigneesRaw = Array.isArray(parsed) ? parsed : [parsed];
          } catch {
            assigneesRaw = [];
          }
        }

        const userIds = assigneesRaw
          .map((a) => a.userId ?? a)
          .filter((id: any) => typeof id === "number");

        let assigneesData: any[] = [];

        if (userIds.length > 0) {
          const users = await User.findAll({
            where: { id: userIds },
            attributes: ["id", "firstname", "lastname", "email"],
          });

          assigneesData = users.map((user) => {
            const assignment = assigneesRaw.find(
              (a) => a.userId === user.id || a === user.id
            );
            return {
              ...user.toJSON(),
              status: assignment?.status || "pending",
            };
          });
        }
        return { ...(lead.toJSON() as any), assignees: assigneesData };
      })
    );

    // ✅ Return paginated + enriched response
    return getPagingData(
      { count: leads.count, rows: enrichedLeads },
      page,
      limit
    );
  } catch (error: any) {
    throw new Error(`Error fetching leads with assignees: ${error.message}`);
  }
};

/**
 * Get counts of assigned and unassigned leads
 */
export const getAssignmentCounts = async () => {
  const assignedCount = await Lead.count({
    where: Sequelize.literal("JSON_LENGTH(assignees) > 0"), // ✅ Has at least one assignment
  });

  const unassignedCount = await Lead.count({
    where: Sequelize.literal("JSON_LENGTH(assignees) = 0"), // ✅ No assignments
  });

  return {
    assignedCount,
    unassignedCount,
  };
};

interface GetUnassignedLeadsParams {
  page?: number;
  limit?: number;
}

interface GetUnassignedLeadsParams {
  page?: number;
  limit?: number;
  searchTerm?: string;
}

interface GetUnassignedLeadsParams {
  page?: number;
  limit?: number;
  searchTerm?: string;
}

export const getUnassignedLeads = async ({
  page = 1,
  limit = 10,
  searchTerm = "",
  campaign, // ✅ NEW: Campaign filter parameter
  filterType,
  startDate,
  endDate,
}: {
  page?: number;
  limit?: number;
  searchTerm?: string;
  campaign?: string; // ✅ NEW
  filterType?: FilterType;
  startDate?: string;
  endDate?: string;
}) => {
  try {
    const { offset, limit: paginationLimit } = getPagination({ page, limit });

    // 🧹 Clean and escape search term safely
    const escapedSearch = searchTerm.trim().toLowerCase().replace(/'/g, "\\'");
    const s = `%${escapedSearch}%`;

    // ✅ Main conditions: only leads with NO assignees
    const andConditions: any[] = [
      Sequelize.literal("(assignees IS NULL OR JSON_LENGTH(assignees) = 0)"),
    ];

    // ✅ NEW: Add campaign filter if provided
    if (campaign && campaign.trim() !== "") {
      const campaignCondition = {
        campaignName: { [Op.like]: `%${campaign.trim()}%` },
      };
      andConditions.push(campaignCondition);
    }

    // 🕒 Apply date filtering (if provided)
    if (filterType) {
      const dateFilter = buildDateFilter(filterType, startDate, endDate);
      andConditions.push(dateFilter);
    }

    // 🔍 Apply search across campaignName + JSON fields
    if (escapedSearch) {
      const jsonSearchCondition = `
        LOWER(JSON_UNQUOTE(JSON_EXTRACT(leadData, '$.agent_name'))) LIKE '${s}'
        OR LOWER(JSON_UNQUOTE(JSON_EXTRACT(leadData, '$.first_name'))) LIKE '${s}'
        OR LOWER(JSON_UNQUOTE(JSON_EXTRACT(leadData, '$.last_name'))) LIKE '${s}'
        OR LOWER(JSON_UNQUOTE(JSON_EXTRACT(leadData, '$.phone_number'))) LIKE '${s}'
        OR LOWER(JSON_UNQUOTE(JSON_EXTRACT(leadData, '$.state'))) LIKE '${s}'
        OR LOWER(JSON_UNQUOTE(JSON_EXTRACT(leadData, '$.email'))) LIKE '${s}'
        OR LOWER(campaignName) LIKE '${s}'
      `;
      andConditions.push(Sequelize.literal(`(${jsonSearchCondition})`));
    }

    // 🧩 Combine all where conditions
    const whereCondition = { [Op.and]: andConditions };

    // 🚀 Fetch unassigned leads
    const unassignedLeads = await Lead.findAndCountAll({
      where: whereCondition,
      order: [["createdAt", "DESC"]],
      offset,
      limit: paginationLimit,
    });

    // 🧩 Normalize assignees (parse JSON safely)
    const normalizedLeads = unassignedLeads.rows.map((lead: any) => {
      let assigneesRaw: any[] = [];
      if (lead.assignees) {
        try {
          const parsed =
            typeof lead.assignees === "string"
              ? JSON.parse(lead.assignees)
              : lead.assignees;
          assigneesRaw = Array.isArray(parsed) ? parsed : [parsed];
        } catch {
          assigneesRaw = [];
        }
      }
      return { ...(lead.toJSON() as any), assignees: assigneesRaw };
    });

    // ✅ Return paginated & cleaned result
    return getPagingData(
      { count: unassignedLeads.count, rows: normalizedLeads },
      page,
      limit
    );
  } catch (error: any) {
    throw new Error(`Error fetching unassigned leads: ${error.message}`);
  }
};

// export const getLeadsByAssigneeId = async (
//   assigneeId: number,
//   filterType: FilterType = "daily",
//   startDate?: string,
//   endDate?: string,
//   page: number = 1,
//   limit: number = 10
// ) => {
//   try {
//     const { offset } = getPagination({ page, limit });

//     // ✅ Get ALL leads assigned to this user (without date filter first)
//     const leads = await Lead.findAndCountAll({
//       where: {
//         [Op.and]: Sequelize.literal(
//           `JSON_CONTAINS(assignees, '{"userId": ${assigneeId}}', '$')`
//         ),
//       },
//       attributes: [
//         "id",
//         "campaignName",
//         "leadData",
//         "assignees",
//         "createdAt",
//         "updatedAt",
//       ],
//       offset,
//       limit,
//     });

//       filterType,
//       totalLeads: leads.count,
//       sampleLead: leads.rows[0]?.get?.() || leads.rows[0] || null,
//     });

//     // ✅ Filter by ASSIGNMENT DATE in JavaScript
//     const now = new Date();
//     const filteredLeads = leads.rows.filter((lead) => {
//       let assignees: AssigneeWithStatus[] = [];

//       try {
//         if (Array.isArray(lead.assignees)) {
//           assignees = lead.assignees;
//         } else if (typeof lead.assignees === "string") {
//           assignees = JSON.parse(lead.assignees);
//         } else if (lead.assignees && typeof lead.assignees === "object") {
//           assignees = lead.assignees as AssigneeWithStatus[];
//         }
//       } catch (error) {
//         return false;
//       }

//       // Find this user's assignment
//       const userAssignment = assignees.find(
//         (a) => Number(a.userId) === assigneeId
//       );

//       if (!userAssignment) return false;

//       // ✅ Use assignedAt if available, otherwise fall back to createdAt
//       const assignmentDate = userAssignment.assignedAt
//         ? new Date(userAssignment.assignedAt)
//         : new Date(lead.createdAt);

//         leadId: lead.id,
//         assignedAt: userAssignment.assignedAt,
//         assignmentDate: assignmentDate.toISOString(),
//         filterType,
//       });

//       // Apply date filtering based on ASSIGNMENT DATE
//       switch (filterType) {
//         case "daily":
//           const todayStart = new Date(
//             now.getFullYear(),
//             now.getMonth(),
//             now.getDate(),
//             0,
//             0,
//             0,
//             0
//           );
//           const todayEnd = new Date(
//             now.getFullYear(),
//             now.getMonth(),
//             now.getDate(),
//             23,
//             59,
//             59,
//             999
//           );
//           const isToday =
//             assignmentDate >= todayStart && assignmentDate <= todayEnd;
//             assignmentDate: assignmentDate.toISOString(),
//             todayStart: todayStart.toISOString(),
//             todayEnd: todayEnd.toISOString(),
//             isToday,
//           });
//           return isToday;

//         case "weekly":
//           const startOfWeek = new Date(now);
//           const day = startOfWeek.getDay();
//           const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
//           const weekStart = new Date(startOfWeek.setDate(diff));
//           weekStart.setHours(0, 0, 0, 0);

//           const weekEnd = new Date(weekStart);
//           weekEnd.setDate(weekStart.getDate() + 6);
//           weekEnd.setHours(23, 59, 59, 999);

//           const isThisWeek =
//             assignmentDate >= weekStart && assignmentDate <= weekEnd;
//             assignmentDate: assignmentDate.toISOString(),
//             weekStart: weekStart.toISOString(),
//             weekEnd: weekEnd.toISOString(),
//             isThisWeek,
//           });
//           return isThisWeek;

//         case "monthly":
//           const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
//           const monthEnd = new Date(
//             now.getFullYear(),
//             now.getMonth() + 1,
//             0,
//             23,
//             59,
//             59,
//             999
//           );
//           const isThisMonth =
//             assignmentDate >= monthStart && assignmentDate <= monthEnd;
//             assignmentDate: assignmentDate.toISOString(),
//             monthStart: monthStart.toISOString(),
//             monthEnd: monthEnd.toISOString(),
//             isThisMonth,
//           });
//           return isThisMonth;

//         case "custom":
//           if (startDate && endDate) {
//             const customStart = new Date(`${startDate}T00:00:00`);
//             const customEnd = new Date(`${endDate}T23:59:59`);
//             return assignmentDate >= customStart && assignmentDate <= customEnd;
//           }
//           return true;

//         default:
//           return true;
//       }
//     });

//     // Map the filtered leads with status
//     const mappedLeads = filteredLeads.map((lead) => {
//       let assignees: AssigneeWithStatus[] = [];

//       try {
//         if (Array.isArray(lead.assignees)) {
//           assignees = lead.assignees;
//         } else if (typeof lead.assignees === "string") {
//           assignees = JSON.parse(lead.assignees);
//         } else if (lead.assignees && typeof lead.assignees === "object") {
//           assignees = lead.assignees as AssigneeWithStatus[];
//         }
//       } catch (error) {
//         assignees = [];
//       }

//       const userAssignment = assignees.find(
//         (a) => Number(a.userId) === assigneeId
//       );

//       return {
//         ...lead.get(),
//         status: userAssignment?.status || "pending",
//         // Include assignment info for debugging
//         assignedAt: userAssignment?.assignedAt,
//         assignmentDate: userAssignment?.assignedAt
//           ? new Date(userAssignment.assignedAt).toISOString()
//           : lead.createdAt.toISOString(),
//       };
//     });

//     return {
//       count: mappedLeads.length,
//       rows: mappedLeads,
//     };
//   } catch (error: any) {
//     throw new Error(
//       `Error fetching leads for assignee ID ${assigneeId}: ${error.message}`
//     );
//   }
// };

export const getLeadsByAssigneeId = async (
  assigneeId: number,
  filterType: FilterType = "daily",
  startDate?: string,
  endDate?: string,
  page: number = 1,
  limit: number = 10,
  campaignName?: string
) => {
  try {
    const { offset } = getPagination({ page, limit });

    // Build the base query with JSON search for assignee
    const baseWhereClause: any = {
      [Op.and]: Sequelize.literal(
        `JSON_CONTAINS(assignees, '{"userId": ${assigneeId}}', '$')`
      ),
    };

    // Add campaign filter
    if (campaignName) {
      baseWhereClause.campaignName = {
        [Op.like]: `%${campaignName}%`,
      };
    }

    // ✅ STEP 1: Get ALL leads that match the base filters (without pagination)
    const allLeads = await Lead.findAll({
      where: baseWhereClause,
      attributes: [
        "id",
        "campaignName",
        "leadData",
        "assignees",
        "leadCode",      // ⬅️ added

        "createdAt",
        "updatedAt",
      ],
      order: [["createdAt", "DESC"]],
    });

    // ✅ STEP 2: Apply date filtering to ALL records
    const now = new Date();
    const filteredLeads = allLeads.filter((lead) => {
      let assignees: AssigneeWithStatus[] = [];
      try {
        if (Array.isArray(lead.assignees)) {
          assignees = lead.assignees.map((a: any) => ({
            userId: Number(a.userId ?? a.userid),
            status: a.status,
            assignedAt: a.assignedAt,
          }));
        } else if (typeof lead.assignees === "string") {
          const parsed = JSON.parse(lead.assignees);
          assignees = parsed.map((a: any) => ({
            userId: Number(a.userId ?? a.userid),
            status: a.status,
            assignedAt: a.assignedAt,
          }));
        } else {
          assignees = [];
        }
      } catch {
        assignees = [];
      }

      const userAssignment = assignees.find(
        (a) => Number(a.userId) === assigneeId
      );

      if (!userAssignment) return false;

      const assignmentDate = userAssignment.assignedAt
        ? new Date(userAssignment.assignedAt)
        : new Date(lead.createdAt);

      switch (filterType) {
        case "daily":
          const todayStart = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
            0,
            0,
            0,
            0
          );
          const todayEnd = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
            23,
            59,
            59,
            999
          );
          return assignmentDate >= todayStart && assignmentDate <= todayEnd;

        case "weekly":
          const startOfWeek = new Date(now);
          const day = startOfWeek.getDay();
          const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
          const weekStart = new Date(startOfWeek.setDate(diff));
          weekStart.setHours(0, 0, 0, 0);

          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekStart.getDate() + 6);
          weekEnd.setHours(23, 59, 59, 999);

          return assignmentDate >= weekStart && assignmentDate <= weekEnd;

        case "monthly":
          const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
          const monthEnd = new Date(
            now.getFullYear(),
            now.getMonth() + 1,
            0,
            23,
            59,
            59,
            999
          );
          return assignmentDate >= monthStart && assignmentDate <= monthEnd;

        case "custom":
          if (startDate && endDate) {
            const customStart = new Date(`${startDate}T00:00:00`);
            const customEnd = new Date(`${endDate}T23:59:59`);
            return assignmentDate >= customStart && assignmentDate <= customEnd;
          }
          return true;

        default:
          return true;
      }
    });

    // ✅ STEP 3: Apply pagination to the FINAL filtered dataset
    const totalCount = filteredLeads.length;
    const startIndex = offset;
    const endIndex = offset + limit;
    const paginatedLeads = filteredLeads.slice(startIndex, endIndex);

    // ✅ STEP 4: Map the paginated results
    const mappedLeads = paginatedLeads.map((lead) => {
      let assignees: AssigneeWithStatus[] = [];

      try {
        if (Array.isArray(lead.assignees)) assignees = lead.assignees;
        else if (typeof lead.assignees === "string")
          assignees = JSON.parse(lead.assignees);
        else assignees = lead.assignees || [];
      } catch {
        assignees = [];
      }

      const userAssignment = assignees.find(
        (a) => Number(a.userId) === assigneeId
      );

      return {
        ...lead.get(),
        status: userAssignment?.status || "pending",
        assignedAt: userAssignment?.assignedAt,
        leadCode: lead.leadCode,  // ⬅️ added

        assignmentDate: userAssignment?.assignedAt
          ? new Date(userAssignment.assignedAt).toISOString()
          : lead.createdAt.toISOString(),
      };
    });

    return {
      count: totalCount, // ✅ Correct total count after ALL filtering
      rows: mappedLeads, // ✅ Correct paginated data
    };
  } catch (error: any) {
    throw new Error(
      `Error fetching leads for assignee ID ${assigneeId}: ${error.message}`
    );
  }
};

export const sendEmailToLeadUsingTemplate = async (
  leadId: number,
  templateKey: string,
  senderUserId: number
) => {
  try {
    // First, check if the lead exists with detailed logging
    const lead = await Lead.findByPk(leadId);

    if (!lead) {
      // Debug: Check all leads to see what's actually in the database
      const allLeads = await Lead.findAll();

      throw new Error("Lead not found");
    }

    let leadData;
    if (typeof lead.leadData === "string") {
      try {
        leadData = JSON.parse(lead.leadData);
      } catch (error: any) {
        throw new Error("Invalid leadData format");
      }
    } else {
      leadData = lead.leadData;
    }

    const email = leadData?.email;

    if (!email) {
      throw new Error("Lead email not found in leadData");
    }

    // Rest of your code...
    const sender = await User.findByPk(senderUserId);
    const senderRole = String(sender?.role || "guest");

    const template = await EmailTemplate.findOne({
      where: { serviceName: templateKey },
    });

    if (!template) throw new Error("Email template not found");

    const filledSubject = fillTemplate(template.subjectTemplate, leadData);
    const filledBody = fillTemplate(template.bodyTemplate, leadData);

    const smtpRaw = await getSmtpConfig(senderUserId);
    const smtp = {
      host: smtpRaw.host || "",
      port: smtpRaw.port || 587,
      user: smtpRaw.user || "",
      pass: smtpRaw.pass || "",
    };

    if (!smtp.host || !smtp.user || !smtp.pass) {
      throw new Error("SMTP configuration is incomplete.");
    }

    await sendEmail({
      smtp,
      to: email,
      subject: filledSubject,
      body: filledBody,
    });

    await logEmailStatus({
      leadId,
      to: email,
      subject: filledSubject,
      body: filledBody,
      templateUsed: templateKey,
      sentBy: senderUserId,
      sentAt: new Date(),
      status: "sent",
    });

    // ✅ Log the activity here
    await logLeadActivity({
      entityId: leadId,
      entityType: "lead",
      action: "email_sent",
      performedBy: senderUserId,
      details: `Email sent using template "${templateKey}" to ${email}`,
    });

    return { message: "Email sent successfully", to: email };
  } catch (error) {
    throw error;
  }
};

// ✅ Helper: replace {{key}} in text with values from leadData
function fillTemplate(template: string, data: any): string {
  return template.replace(/{{(.*?)}}/g, (_, key) => {
    const trimmedKey = key.trim();
    return data?.[trimmedKey] || "";
  });
}

export const getLeadStatusSummary = async (assigneeId?: number) => {
  try {
    const statuses = [
      "pending",
      "sold",
      "most_interested",
      "to_call",
      "not_interested",
    ];
    const statusCounts: Record<string, number> = {};
    const leadsByStatus: Record<string, any[]> = {};

    for (const status of statuses) {
      let whereCondition;

      if (assigneeId) {
        // ✅ PROVEN WORKING: Simple JSON_CONTAINS approach
        whereCondition = Sequelize.literal(`
          JSON_CONTAINS(assignees, JSON_OBJECT('userId', ${assigneeId}))
          AND JSON_CONTAINS(assignees, JSON_OBJECT('status', '${status}'))
        `);
      } else {
        // For no assigneeId filter
        whereCondition = Sequelize.literal(`
          JSON_CONTAINS(assignees, JSON_OBJECT('status', '${status}'))
        `);
      }

      const leads = await Lead.findAll({
        where: whereCondition,
        order: [["createdAt", "DESC"]],
      });

      statusCounts[status] = leads.length;
      // leadsByStatus[status] = leads;
      leadsByStatus[status] = leads.map((lead) => ({
        ...(lead.toJSON() as any),
      }));
    }

    return { statusCounts, leadsByStatus };
  } catch (error: any) {
    throw new Error(`Error getting lead status summary: ${error.message}`);
  }
};

const ALLOWED_STATUSES: LeadStatus[] = [
  "pending",
  "sold",
  "most_interested",
  "to_call",
  "not_interested",
];

export type LeadStatus =
  | "pending"
  | "to_call"
  | "interested"
  | "most_interested"
  | "sold"
  | "not_interested"
  | "do_not_call";

export const updateLeadStatusForUser = async (
  leadId: number,
  userId: number,
  newStatus: LeadStatus
) => {
  if (!ALLOWED_STATUSES.includes(newStatus)) {
    throw new Error(
      `Invalid status. Allowed statuses: ${ALLOWED_STATUSES.join(", ")}`
    );
  }

  const lead = await Lead.findByPk(leadId);
  if (!lead) {
    throw new Error(`Lead with ID ${leadId} not found`);
  }

  let assignees: AssigneeWithStatus[] = [];

  try {
    if (Array.isArray(lead.assignees)) {
      assignees = lead.assignees;
    } else if (typeof lead.assignees === "string") {
      assignees = JSON.parse(lead.assignees);
    } else if (lead.assignees && typeof lead.assignees === "object") {
      assignees = lead.assignees as AssigneeWithStatus[];
    }
  } catch (err) {
    assignees = [];
  }

  // ✅ Normalize userId comparison
  const index = assignees.findIndex((a) => Number(a.userId) === Number(userId));

  if (index === -1) {
    throw new Error(`User ID ${userId} is not assigned to lead ID ${leadId}`);
  }

  const previousStatus = assignees[index].status;
  assignees[index].status = newStatus;

  // ✅ Directly update JSON column
  await lead.update({ assignees });

  // ✅ Log the activity
  try {
    const logResult = await logLeadActivity({
      entityId: leadId,
      entityType: "lead",
      action: "status_updated",
      performedBy: userId,
      details: `Status changed from "${previousStatus}" to "${newStatus}"`,
    });
  } catch (err) { }

  // return lead;
  return { ...(lead.toJSON() as any) };
};

export const getLeadsByCampaignAndAssignee = async (
  campaignName: string,
  assigneeId: number
): Promise<LeadAttributes[]> => {
  try {
    const leads = await Lead.findAll({
      where: {
        campaignName,
        [Op.and]: [
          where(
            fn(
              "JSON_CONTAINS",
              col("assignees"),
              literal(`JSON_OBJECT('userId', ${assigneeId})`)
            ),
            true
          ),
        ],
      },
    });

    return leads.map((lead) => ({ ...(lead.toJSON() as any) }));

    // return leads.map((lead) => lead.get());
  } catch (error: any) {
    throw new Error(
      `Error fetching leads for campaign '${campaignName}' and assignee '${assigneeId}': ${error.message}`
    );
  }
};
