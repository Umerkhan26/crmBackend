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
import { DateTime } from "luxon";

interface PaginationParams {
  page?: number;
  limit?: number;
}
interface LeadQueryParams extends PaginationParams {
  filters?: Record<string, any>;
  search?: string;
}
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
  campaign,
  conditions = [],
  filterType,
  startDate,
  endDate,
}: GetAllLeadsParams) => {
  try {
    const { offset, limit: pageLimit } = getPagination({ page, limit });

    // Base where condition
    const whereCondition: any = { ...filters };

    // Optional campaign filter
    if (campaign && campaign.trim() !== "") {
      whereCondition.campaignName = { [Op.like]: `%${campaign.trim()}%` };
    }

    // Date filter
    if (filterType) {
      const dateFilter = buildDateFilter(filterType, startDate, endDate);
      Object.assign(whereCondition, dateFilter);
    }

    // Dynamic conditions (if any)
    if (conditions.length > 0) {
      Object.assign(whereCondition, { [Op.and]: conditions });
    }

    // STEP 1: Fetch ALL leads matching filters (no pagination yet)
    const allLeads = await Lead.findAll({
      where: whereCondition,
      order: [["createdAt", "DESC"]],
    });

    // STEP 2: Enrich assignees
    const enrichedLeads = await Promise.all(
      allLeads.map(async (lead) => {
        let assigneesRaw: AssigneeWithStatus[] = [];

        if (typeof lead.assignees === "string") {
          try {
            assigneesRaw = JSON.parse(lead.assignees);
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

    // STEP 3: GLOBAL search (search anywhere in JSON + campaign + assignees)
    const filteredLeads = search
      ? enrichedLeads.filter((lead) =>
          JSON.stringify(lead).toLowerCase().includes(search.toLowerCase())
        )
      : enrichedLeads;

    // STEP 4: PAGINATION
    const total = filteredLeads.length;
    const start = (page - 1) * limit;
    const end = start + limit;

    const paginated = filteredLeads.slice(start, end);

    // STEP 5: Return paging data
    return {
      totalItems: total,
      rows: paginated,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      pageSize: limit,
    };
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
  search?: string;
  filterType?: FilterType;
}
export interface EnrichedAssignee {
  id: number;
  firstname: string;
  lastname: string;
  email: string;
  status: LeadStatus;
}

export const getLeadsByCampaign = async ({
  campaignName,
  page = 1,
  limit = 10,
  search = "",
  conditions = [],
  startDate,
  endDate,
  filterType,
}: GetLeadsByCampaignParams & {
  conditions?: any[];
  startDate?: string;
  endDate?: string;
  filterType?: FilterType;
}): Promise<any> => {
  try {
    // Step 1: Build dynamic filter for JSON fields
    const dynamicFilter =
      conditions.length > 0 ? buildDynamicFilters(conditions) : {};

    // Step 2: Handle Date Filters (similar to the other function)
    const dateFilter = filterType
      ? buildDateFilter(filterType, startDate, endDate)
      : {};

    // Step 3: Fetch ALL leads for the campaign (NO pagination)
    const allLeads = await Lead.findAll({
      where: {
        campaignName,
        ...dynamicFilter,
        ...dateFilter, // Add the date filter to the `where` condition
      },
      order: [["createdAt", "DESC"]],
    });

    // Step 4: Enrich leads based on assignees
    const enrichedLeads = await Promise.all(
      allLeads.map(async (lead) => {
        let assigneesRaw: AssigneeWithStatus[] = [];

        if (Array.isArray(lead.assignees)) {
          assigneesRaw = lead.assignees;
        } else if (typeof lead.assignees === "string") {
          try {
            assigneesRaw = JSON.parse(lead.assignees);
          } catch {
            assigneesRaw = [];
          }
        } else if (
          typeof lead.assignees === "object" &&
          lead.assignees !== null
        ) {
          assigneesRaw = [lead.assignees];
        }

        const userIds = assigneesRaw
          .map((a) => a.userId)
          .filter((id): id is number => typeof id === "number");

        let assigneesData: EnrichedAssignee[] = [];

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
            } as EnrichedAssignee;
          });
        }

        return {
          ...lead.toJSON(),
          assignees: assigneesData,
        };
      })
    );

    // Step 5: GLOBAL SEARCH across all fields
    const filteredLeads = search
      ? enrichedLeads.filter((lead) => {
          const jsonStr = JSON.stringify(lead).toLowerCase();
          return jsonStr.includes(search.toLowerCase());
        })
      : enrichedLeads;

    // Step 6: Pagination AFTER filtering
    const total = filteredLeads.length;
    const start = (page - 1) * limit;
    const end = start + limit;

    return {
      totalItems: total,
      rows: filteredLeads.slice(start, end),
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      pageSize: limit,
    };
  } catch (error: any) {
    throw new Error(
      `Error fetching leads for campaign ${campaignName}: ${error.message}`
    );
  }
};

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

    return { ...(lead.toJSON() as any) };
  } catch (error: any) {
    throw new Error(`Error updating lead: ${error.message}`);
  }
};

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

    if (typeof lead.assignees === "string") {
      try {
        currentAssignees = JSON.parse(lead.assignees);
      } catch {
        currentAssignees = [];
      }
    } else if (Array.isArray(lead.assignees)) {
      currentAssignees = lead.assignees as AssigneeWithStatus[];
    }

    const existingIds = new Set<number>(currentAssignees.map((a) => a.userId));

    const assignmentTimestamp = new Date().toISOString();

    const newAssignees: AssigneeWithStatus[] = userIdsToAssign
      .filter((id: number) => !existingIds.has(id))
      .map((id: number) => ({
        userId: id,
        status: "pending",
        assignedAt: assignmentTimestamp,
        status_updated: false,
      }));

    if (newAssignees.length === 0) {
      throw new Error("All provided users are already assigned to this lead.");
    }

    const updatedAssignees = [...currentAssignees, ...newAssignees];

    await lead.update({ assignees: updatedAssignees });

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

    return { ...(lead.toJSON() as any) };
  } catch (error: any) {
    throw new Error(`Error assigning lead: ${error.message}`);
  }
};
export interface GetAllLeadsParams {
  page?: number;
  limit?: number;
  filters?: any;
  search?: string;
  campaign?: string;
  conditions?: any[];
  filterType?: FilterType;
  startDate?: string;
  endDate?: string;
}

export const getAllLeadsWithAssignee = async ({
  page = 1,
  limit = 10,
  search = "",
  campaign,
  filterType,
  startDate,
  endDate,
  conditions = [], // ← added
}: {
  page?: number;
  limit?: number;
  search?: string;
  campaign?: string;
  filterType?: FilterType;
  startDate?: string;
  endDate?: string;
  conditions?: any[]; // ← added
}) => {
  try {
    const baseCondition = Sequelize.literal("JSON_LENGTH(assignees) > 0");
    const whereConditions: any = {
      [Op.and]: [baseCondition],
    };
    // ─────────────────────────────────────────
    // Campaign filter
    // ─────────────────────────────────────────
    if (campaign && campaign.trim() !== "") {
      whereConditions[Op.and].push({
        campaignName: { [Op.like]: `%${campaign.trim()}%` },
      });
    }
    // ─────────────────────────────────────────
    // Date filter
    // ─────────────────────────────────────────
    if (filterType) {
      const dateFilter = buildDateFilter(filterType, startDate, endDate);
      whereConditions[Op.and].push(dateFilter);
    }
    // ─────────────────────────────────────────
    // ⭐ Dynamic JSON field filtering (main part)
    // ─────────────────────────────────────────
    if (conditions.length > 0) {
      const dynamicFilter = buildDynamicFilters(conditions);
      whereConditions[Op.and].push(dynamicFilter);
    }
    // ─────────────────────────────────────────
    // Fetch ALL leads (NO pagination, search applied later)
    // ─────────────────────────────────────────
    const leads = await Lead.findAll({
      where: whereConditions,
      order: [["createdAt", "DESC"]],
    });
    // ─────────────────────────────────────────
    // Enrich assignees
    // ─────────────────────────────────────────
    const enrichedLeads = await Promise.all(
      leads.map(async (lead: any) => {
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
    // ─────────────────────────────────────────
    // GLOBAL SEARCH across all fields
    // ─────────────────────────────────────────
    const filteredLeads =
      search && search.trim() !== ""
        ? enrichedLeads.filter((lead) => {
            const jsonStr = JSON.stringify(lead).toLowerCase();
            return jsonStr.includes(search.trim().toLowerCase());
          })
        : enrichedLeads;
    // ─────────────────────────────────────────
    // Pagination AFTER filtering
    // ─────────────────────────────────────────
    const total = filteredLeads.length;
    const start = (page - 1) * limit;
    const end = start + limit;
    const paginatedRows = filteredLeads.slice(start, end);
    return getPagingData({ count: total, rows: paginatedRows }, page, limit);
  } catch (error: any) {
    throw new Error(`Error fetching leads with assignees: ${error.message}`);
  }
};

export const getAssignmentCounts = async () => {
  const assignedCount = await Lead.count({
    where: Sequelize.literal("JSON_LENGTH(assignees) > 0"),
  });

  const unassignedCount = await Lead.count({
    where: Sequelize.literal("JSON_LENGTH(assignees) = 0"),
  });

  return {
    assignedCount,
    unassignedCount,
  };
};

export interface GetUnassignedLeadsParams {
  page?: number;
  limit?: number;
  searchTerm?: string;
  campaign?: string;
  filterType?: FilterType; // restrict to exact strings
  startDate?: string;
  endDate?: string;
}

export const getUnassignedLeads = async ({
  page = 1,
  limit = 10,
  searchTerm = "",
  campaign,
  filterType,
  startDate,
  endDate,
  conditions = [],
}: GetUnassignedLeadsParams & { conditions?: any[] }) => {
  try {
    // STEP 1: Build base where condition for unassigned leads
    const whereCondition: any = {
      [Op.and]: [
        Sequelize.literal("(assignees IS NULL OR JSON_LENGTH(assignees) = 0)"),
      ],
    };
    // STEP 2: Campaign filter
    if (campaign && campaign.trim() !== "") {
      whereCondition[Op.and].push({
        campaignName: { [Op.like]: `%${campaign.trim()}%` },
      });
    }
    // STEP 3: Date filter
    if (filterType) {
      const dateFilter = buildDateFilter(filterType, startDate, endDate);
      whereCondition[Op.and].push(dateFilter);
    }
    // STEP 4: Dynamic JSON field filtering
    if (conditions.length > 0) {
      const dynamicFilter = buildDynamicFilters(conditions);
      whereCondition[Op.and].push(dynamicFilter);
    }
    // STEP 5: Fetch ALL leads with Sequelize (NO search or pagination here)
    const leads = await Lead.findAll({
      where: whereCondition,
      order: [["createdAt", "DESC"]],
    });
    // STEP 6: Enrich assignees
    const enrichedLeads = await Promise.all(
      leads.map(async (lead) => {
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
        const plainLead = lead.toJSON();
        return { ...plainLead, assignees: assigneesData };
      })
    );
    // STEP 7: GLOBAL SEARCH across all fields (applied always, after dynamic filters)
    const filteredLeads =
      searchTerm && searchTerm.trim() !== ""
        ? enrichedLeads.filter((lead) => {
            const jsonStr = JSON.stringify(lead).toLowerCase();
            return jsonStr.includes(searchTerm.trim().toLowerCase());
          })
        : enrichedLeads;
    // STEP 8: Pagination AFTER filtering
    const total = filteredLeads.length;
    const start = (page - 1) * limit;
    const end = start + limit;
    return {
      totalItems: total,
      rows: filteredLeads.slice(start, end),
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      pageSize: limit,
    };
  } catch (error: any) {
    throw new Error(`Error fetching unassigned leads: ${error.message}`);
  }
};

const buildDynamicFilters = (conditions: any[]) => {
  if (!conditions || conditions.length === 0) return {};

  const sequelizeFilters: any[] = [];

  conditions.forEach((c) => {
    console.log("🔍 Processing condition:", c);

    const operator = c.condition || c.operator;
    const value = c.value || "";
    const field = c.field;
    const logic = c.joinType || "AND";

    if (!field) {
      console.warn("Skipping condition - missing field:", c);
      return;
    }

    const jsonField = Sequelize.literal(
      `JSON_UNQUOTE(JSON_EXTRACT(leadData, '$.${field}'))`
    );

    let condition: any;

    switch (operator.toLowerCase()) {
      case "equals":
      case "is":
        condition = Sequelize.where(jsonField, value);
        break;

      case "notequals":
      case "is not":
      case "not equals":
        condition = Sequelize.where(jsonField, { [Op.ne]: value });
        break;

      case "contains":
        condition = Sequelize.where(jsonField, {
          [Op.like]: `%${value}%`,
        });
        break;

      case "notcontains":
      case "does not contain":
      case "not contains":
        condition = Sequelize.where(jsonField, {
          [Op.notLike]: `%${value}%`,
        });
        break;

      case "isblank":
      case "is blank":
        condition = {
          [Op.or]: [
            Sequelize.where(jsonField, ""),
            Sequelize.where(jsonField, null),
            Sequelize.where(jsonField, {
              [Op.eq]: Sequelize.literal("JSON_UNQUOTE('')"),
            }),
          ],
        };
        break;

      case "isnotblank":
      case "is not blank":
        condition = {
          [Op.and]: [
            Sequelize.where(jsonField, { [Op.ne]: "" }),
            Sequelize.where(jsonField, { [Op.ne]: null }),
            Sequelize.where(jsonField, {
              [Op.not]: Sequelize.literal("JSON_UNQUOTE('')"),
            }),
          ],
        };
        break;

      default:
        console.warn(`Unknown operator: ${operator}, defaulting to equals`);
        condition = Sequelize.where(jsonField, value);
        break;
    }

    sequelizeFilters.push({
      logic: logic,
      condition,
    });

    console.log(`✅ Built filter: ${field} ${operator} "${value}"`);
  });

  // Combine using AND / OR dynamic grouping
  let finalWhere: any = {};

  sequelizeFilters.forEach((f, index) => {
    if (index === 0) {
      finalWhere = { [Op.and]: [f.condition] };
    } else {
      if (f.logic.toUpperCase() === "AND") {
        if (!finalWhere[Op.and]) finalWhere[Op.and] = [];
        finalWhere[Op.and].push(f.condition);
      } else {
        if (!finalWhere[Op.or]) finalWhere[Op.or] = [];
        finalWhere[Op.or].push(f.condition);
      }
    }
  });

  console.log("🔍 Final dynamic filter:", JSON.stringify(finalWhere, null, 2));
  return finalWhere;
};

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

    // Add campaign filter if provided
    if (campaignName) {
      baseWhereClause[Op.and] = Sequelize.and(baseWhereClause[Op.and], {
        campaignName: { [Op.like]: `%${campaignName}%` },
      });
    }

    // STEP 1: Get all leads matching base filters
    const allLeads = await Lead.findAll({
      where: baseWhereClause,
      attributes: [
        "id",
        "campaignName",
        "leadData",
        "assignees",
        "createdAt",
        "updatedAt",
      ],
      order: [["createdAt", "DESC"]],
    });

    // STEP 2: Apply date filtering to ALL records (PST)
    const nowPST = DateTime.now().setZone("Asia/Karachi"); // Pakistan Time
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
        }
      } catch {
        assignees = [];
      }

      const userAssignment = assignees.find(
        (a) => Number(a.userId) === assigneeId
      );
      if (!userAssignment) return false;

      const assignmentDate = userAssignment.assignedAt
        ? DateTime.fromISO(userAssignment.assignedAt, { zone: "Asia/Karachi" }) // FIXED monthly filter issue
        : DateTime.fromJSDate(lead.createdAt).setZone("Asia/Karachi");

      // Apply date filters based on PST
      switch (filterType) {
        case "daily": {
          const todayStart = nowPST.startOf("day");
          const todayEnd = nowPST.endOf("day");
          return assignmentDate >= todayStart && assignmentDate <= todayEnd;
        }

        case "weekly": {
          const weekStart = nowPST.startOf("week").minus({ days: 1 }); // Sunday
          const weekEnd = nowPST.endOf("week").minus({ days: 1 }); // Saturday
          return assignmentDate >= weekStart && assignmentDate <= weekEnd;
        }

        case "monthly": {
          const monthStart = nowPST.startOf("month");
          const monthEnd = nowPST.endOf("month");
          return assignmentDate >= monthStart && assignmentDate <= monthEnd;
        }

        case "custom": {
          if (startDate && endDate) {
            const customStart = DateTime.fromISO(startDate)
              .startOf("day")
              .setZone("Asia/Karachi");
            const customEnd = DateTime.fromISO(endDate)
              .endOf("day")
              .setZone("Asia/Karachi");
            return assignmentDate >= customStart && assignmentDate <= customEnd;
          }
          return true;
        }

        default:
          return true;
      }
    });

    // STEP 3: Apply pagination
    const totalCount = filteredLeads.length;
    const paginatedLeads = filteredLeads.slice(offset, offset + limit);

    // STEP 4: Map paginated results
    const mappedLeads = paginatedLeads.map((lead) => {
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
        }
      } catch {
        assignees = [];
      }

      const userAssignment = assignees.find(
        (a) => Number(a.userId) === assigneeId
      );

      return {
        ...lead.get(),
        leadCode: lead.leadCode,
        status: userAssignment?.status || "pending",
        assignedAt: userAssignment?.assignedAt,
        assignmentDate: userAssignment?.assignedAt
          ? DateTime.fromISO(userAssignment.assignedAt)
              .setZone("Asia/Karachi")
              .toISO()
          : DateTime.fromJSDate(lead.createdAt).setZone("Asia/Karachi").toISO(),
      };
    });

    return {
      count: totalCount,
      rows: mappedLeads,
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
    const lead = await Lead.findByPk(leadId);

    if (!lead) {
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
        whereCondition = Sequelize.literal(`
          JSON_CONTAINS(assignees, JSON_OBJECT('userId', ${assigneeId}))
          AND JSON_CONTAINS(assignees, JSON_OBJECT('status', '${status}'))
        `);
      } else {
        whereCondition = Sequelize.literal(`
          JSON_CONTAINS(assignees, JSON_OBJECT('status', '${status}'))
        `);
      }

      const leads = await Lead.findAll({
        where: whereCondition,
        order: [["createdAt", "DESC"]],
      });

      statusCounts[status] = leads.length;
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

  const index = assignees.findIndex((a) => Number(a.userId) === Number(userId));

  if (index === -1) {
    throw new Error(`User ID ${userId} is not assigned to lead ID ${leadId}`);
  }

  const previousStatus = assignees[index].status;
  assignees[index].status = newStatus;

  await lead.update({ assignees });

  try {
    const logResult = await logLeadActivity({
      entityId: leadId,
      entityType: "lead",
      action: "status_updated",
      performedBy: userId,
      details: `Status changed from "${previousStatus}" to "${newStatus}"`,
    });
  } catch (err) {}

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
  } catch (error: any) {
    throw new Error(
      `Error fetching leads for campaign '${campaignName}' and assignee '${assigneeId}': ${error.message}`
    );
  }
};
