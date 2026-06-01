import { literal, Op, Sequelize, where, fn, col, QueryTypes } from "sequelize";
import db from "../../db";
import Lead, {
  AssigneeWithStatus,
  LeadAttributes,
  LeadCreationAttributes,
} from "../models/lead.model";
import { buildSearchFilter } from "../utils/filterQuery";
import { getPagination, getPagingData } from "../utils/paginate";
import { logActivity } from "./activity.service";
import { emitSocketToUser, sendNotification } from "./notification.service";
import User from "../models/user.model";
import { checkEmailPermission } from "./email.service";
import EmailTemplate from "../models/emailTemplate.model";
import { getSmtpConfig } from "../utils/getSmtpConfig";
import { sendEmail } from "../utils/email";
import { leadAssignmentTemplate } from "../Templetes/leadAssignmentTemplate";
import { logEmailStatus } from "./emailLog.service";
import { UserAttributes } from "../interfaces/user.interface";
import { buildDateFilter, FilterType } from "../utils/dateFilters";
import { normalizePhone } from "../utils/phoneNormalizer";
import { logLeadActivity } from "../utils/logLeadActivity";
import Campaign from "../models/campaign.model";
import { DateTime } from "luxon";
import {
  getPktMonthlyShiftWindow,
  getPktShiftDailyWindow,
  getPktWeeklyShiftWindow,
  PKT_ZONE,
} from "../utils/pktReportingWindows";
import Note from "../models/note.model";
import LeadActivity from "../models/leadActivity.model";
import Role from "../models/role.model";
import { Permission } from "../models/permission.model";
import {
  getStatusCountsForUserActivityPeriod,
} from "./leadActivity.service";
import LeadRotationState from "../models/leadRotationState.model";
import { getBrandManagerIdsForUser, getManagerBrandUserIds } from "../utils/brandUtils";
import LeadLock from "../models/leadLock.model";
import {
  buildLeadCodeFromCampaignAndId,
  leadEnrichedRowMatchesSearch,
  leadPartialRowMatchesSearch,
  normalizeLeadCodeSearchInput,
} from "../utils/leadCode";
import { leadRowHasContactPhone } from "../utils/normalizeLeadData";
import {
  appendContactStateToWhere,
  appendLeadSearchToWhere,
  clampLeadListPagination,
  enrichLeadsBatch,
} from "../utils/leadListQuery";

interface PaginationParams {
  page?: number;
  limit?: number;
}
interface LeadQueryParams extends PaginationParams {
  filters?: Record<string, any>;
  search?: string;
}

/**
 * Check if a lead with the same phone number already exists
 */
const checkDuplicateLead = async (
  phoneNumber: string | null | undefined,
  campaignName?: string,
): Promise<LeadAttributes | null> => {
  if (!phoneNumber) return null;

  const normalizedPhone = normalizePhone(phoneNumber);
  if (!normalizedPhone) return null;

  try {
    // Build query to check for duplicate phone number in leadData JSON
    // Use Sequelize.where with fn for safe parameterized query
    const whereCondition: any = {
      [Op.and]: [
        where(fn("JSON_EXTRACT", col("leadData"), "$.number"), normalizedPhone),
      ],
    };

    // Optionally check within the same campaign
    if (campaignName) {
      whereCondition.campaignName = campaignName;
    }

    const existingLead = await Lead.findOne({
      where: whereCondition,
    });

    return existingLead ? existingLead.get() : null;
  } catch (error: any) {
    console.error("Error checking duplicate lead:", error);
    // Don't throw error, just return null to allow creation to proceed
    return null;
  }
};

export const createLead = async (
  data: LeadCreationAttributes,
  userId?: number,
): Promise<LeadAttributes & { leadCode: string }> => {
  try {
    // Check for duplicate phone number before creating
    const phoneNumber =
      data.leadData?.number || data.leadData?.phone_number || null;
    const duplicateLead = await checkDuplicateLead(
      phoneNumber,
      data.campaignName,
    );

    if (duplicateLead) {
      throw new Error(
        `Duplicate lead found: A lead with phone number "${phoneNumber}" already exists in campaign "${data.campaignName}" (Lead ID: ${duplicateLead.id})`,
      );
    }

    // Add createdBy to the lead data if userId is provided
    const leadDataWithCreator = userId ? { ...data, createdBy: userId } : data;
    const lead = await Lead.create(leadDataWithCreator);

    if (userId) {
      // Fetch user to get full name for activity log
      const user = await User.findByPk(userId);
      const fullName = user
        ? `${user.firstname || ""} ${user.lastname || ""}`.trim()
        : null;

      await logActivity(
        userId,
        "create",
        `Lead created with ID ${lead.id}`,
        fullName || undefined,
      );
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
  assignmentState = "all",
  contactState = "all",
  onlyPromotedFromIncoming = false,
  userId, // Add userId parameter to filter by creator
  isAdmin = false, // Add isAdmin flag
  isManager = false, // Add isManager flag
  managerBrandUserIds = [], // User IDs under brands managed by this manager
}: GetAllLeadsParams & {
  userId?: number;
  isAdmin?: boolean;
  isManager?: boolean;
  managerBrandUserIds?: number[];
}) => {
  try {
    // Base where condition
    const whereCondition: any = { ...filters };

    if (onlyPromotedFromIncoming) {
      whereCondition[Op.and] = whereCondition[Op.and] || [];
      whereCondition[Op.and].push({
        id: {
          [Op.in]: literal(
            "(SELECT targetLeadId FROM incoming_leads WHERE status = 'promoted' AND targetLeadId IS NOT NULL)",
          ),
        },
      });
    }

    // Optional campaign filter (exact, case-insensitive)
    if (campaign && campaign.trim() !== "") {
      whereCondition[Op.and] = whereCondition[Op.and] || [];
      whereCondition[Op.and].push(
        Sequelize.where(
          Sequelize.fn("LOWER", Sequelize.col("campaignName")),
          campaign.trim().toLowerCase(),
        ),
      );
    }

    if (assignmentState === "assigned") {
      whereCondition[Op.and] = whereCondition[Op.and] || [];
      whereCondition[Op.and].push(
        Sequelize.literal("(assignees IS NOT NULL AND JSON_LENGTH(assignees) > 0)"),
      );
    } else if (assignmentState === "unassigned") {
      whereCondition[Op.and] = whereCondition[Op.and] || [];
      whereCondition[Op.and].push(
        Sequelize.literal("(assignees IS NULL OR JSON_LENGTH(assignees) = 0)"),
      );
    }

    // Manager logic: Managers see all master leads + leads from their brand users
    if (isManager && managerBrandUserIds.length > 0) {
      // Managers see:
      // 1. All master leads (no restriction - handled by not filtering)
      // 2. Leads created by their brand users
      // 3. Leads assigned to their brand users
      
      // Build OR condition for manager
      const managerConditions: any[] = [];
      
      // Leads created by brand users
      managerConditions.push({
        createdBy: {
          [Op.in]: managerBrandUserIds,
        },
      });
      
      // Leads assigned to brand users (check if assignees JSON contains brand user IDs)
      // This is complex - we'll filter after fetching
      
      // For now, we'll include all leads and filter assignees later
      // The whereCondition will not restrict by createdBy for managers
    } else if (!isAdmin && userId) {
      // Filter by creator if user is not admin and not a manager
      // Non-admin users should only see leads they created themselves
      whereCondition.createdBy = userId;
    }

    // Date filter
    if (filterType) {
      const dateFilter = buildDateFilter(filterType, startDate, endDate);
      // Only add date filter if it has actual conditions (check for createdAt property)
      if (dateFilter && "createdAt" in dateFilter) {
        console.log("📅 Applying date filter (all leads):", {
          filterType,
          startDate,
          endDate,
          dateFilter,
        });
        Object.assign(whereCondition, dateFilter);
      } else {
        console.log("⚠️ Date filter returned empty object (all leads):", {
          filterType,
          startDate,
          endDate,
        });
      }
    }

    // Dynamic conditions (if any) — merge into Op.and so we do not drop campaign / incoming filters
    if (conditions.length > 0) {
      const existingAnd = whereCondition[Op.and];
      const andArray = Array.isArray(existingAnd) ? existingAnd : existingAnd != null ? [existingAnd] : [];
      whereCondition[Op.and] = [...andArray, ...conditions];
    }

    if (search?.trim()) {
      appendLeadSearchToWhere(whereCondition, search);
    }
    if (contactState === "present" || contactState === "missing") {
      appendContactStateToWhere(whereCondition, contactState);
    }

    const { pageNum, pageSize, offset } = clampLeadListPagination(page, limit);

    const { count, rows } = await Lead.findAndCountAll({
      where: whereCondition,
      order: [["createdAt", "DESC"]],
      limit: pageSize,
      offset,
    });

    const enrichedLeads = await enrichLeadsBatch(rows);

    return {
      totalItems: count,
      rows: enrichedLeads,
      currentPage: pageNum,
      totalPages: count <= 0 ? 0 : Math.ceil(count / pageSize),
      pageSize,
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

    const userIds = [
      ...new Set(
        assigneesRaw
          .map((a) => Number(a.userId))
          .filter((id) => Number.isFinite(id) && id > 0),
      ),
    ];

    let assigneesData: any[] = [];

    if (userIds.length > 0) {
      const users = await User.findAll({
        where: { id: userIds },
        attributes: ["id", "firstname", "lastname", "email"],
      });

      assigneesData = users.map((user) => {
        const assignment = assigneesRaw.find(
          (a) => Number(a.userId) === Number(user.id),
        );
        const profile = user.toJSON();
        if (!assignment) {
          return {
            ...profile,
            userId: user.id,
            status: "pending",
          };
        }
        // Keep full assignee payload (hot lead review, comments, etc.); profile fills names/email.
        return {
          ...assignment,
          ...profile,
          userId: user.id,
          status: assignment.status || profile.status || "pending",
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
  onlyExited?: boolean;
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
  userId, // Add userId parameter to filter by creator
  isAdmin = false, // Add isAdmin flag to determine if user should see all leads
  createdBy, // Add createdBy parameter to filter by specific creator (for admin)
  onlyExited = true,
}: GetLeadsByCampaignParams & {
  conditions?: any[];
  startDate?: string;
  endDate?: string;
  filterType?: FilterType;
  userId?: number;
  isAdmin?: boolean;
  createdBy?: number; // Filter by specific creator (admin only)
  onlyExited?: boolean;
}): Promise<any> => {
  try {
    // Step 1: Build dynamic filter for JSON fields
    const dynamicFilter =
      conditions.length > 0 ? buildDynamicFilters(conditions) : {};

    // Step 2: Handle Date Filters (similar to the other function)
    const dateFilter = filterType
      ? buildDateFilter(filterType, startDate, endDate)
      : {};

    // Check if dateFilter has actual conditions (check for createdAt property)
    const hasDateFilter = filterType && dateFilter && "createdAt" in dateFilter;

    if (hasDateFilter) {
      console.log("📅 Applying date filter (by campaign):", {
        filterType,
        startDate,
        endDate,
        dateFilter,
      });
    }

    // Step 3: Build where condition (using old simple logic)
    const whereCondition: any = {
      campaignName,
      ...dynamicFilter,
    };

    // Only merge dateFilter if it has actual conditions
    if (hasDateFilter) {
      Object.assign(whereCondition, dateFilter);
      console.log("📅 Merged dateFilter into whereCondition:", {
        whereCondition,
        dateFilterKeys: Object.keys(dateFilter),
        createdAtValue: whereCondition.createdAt,
      });
    }

    // Filter by creator
    // Non-admin users: only see leads they created themselves
    // Admin users: can filter by specific creator if createdBy is provided
    if (!isAdmin && userId) {
      whereCondition.createdBy = userId;
    } else if (isAdmin && createdBy) {
      // Admin filtering by specific creator
      whereCondition.createdBy = createdBy;
    }

    // Pipeline rule (onlyExited): new auto-assignment leads have a `lead_rotation_state` row —
    // hide them until full pipeline exit (Team E) or Team A lock-expiry exceptional release.
    // Leads with no rotation row are legacy and keep the old behavior (always visible here).
    if (onlyExited) {
      const inPipelineRows = await LeadRotationState.findAll({
        attributes: ["leadId"],
        where: {
          [Op.and]: [
            { [Op.or]: [{ isPipelineCompleted: false }, { isPipelineCompleted: null }] },
            { [Op.or]: [{ isExceptionalRelease: false }, { isExceptionalRelease: null }] },
          ],
        } as any,
      });
      const inPipelineLeadIds = Array.from(
        new Set(inPipelineRows.map((r: any) => Number(r.leadId)).filter((x) => Number.isFinite(x))),
      );
      if (inPipelineLeadIds.length > 0) {
        whereCondition.id = { [Op.notIn]: inPipelineLeadIds };
      }
    }

    if (search?.trim()) {
      appendLeadSearchToWhere(whereCondition, search);
    }

    const { pageNum, pageSize, offset } = clampLeadListPagination(page, limit);

    const { count, rows } = await Lead.findAndCountAll({
      where: whereCondition,
      order: [["createdAt", "DESC"]],
      limit: pageSize,
      offset,
    });

    const enrichedLeads = await enrichLeadsBatch(rows);

    return {
      totalItems: count,
      rows: enrichedLeads,
      currentPage: pageNum,
      totalPages: count <= 0 ? 0 : Math.ceil(count / pageSize),
      pageSize,
    };
  } catch (error: any) {
    throw new Error(
      `Error fetching leads for campaign ${campaignName}: ${error.message}`,
    );
  }
};

export const updateLead = async (
  id: number,
  updatedData: Partial<LeadCreationAttributes>,
  userId?: number,
): Promise<LeadAttributes> => {
  try {
    const lead = await Lead.findByPk(id);
    if (!lead) {
      throw new Error("Lead not found");
    }

    await lead.update(updatedData);

    if (userId) {
      // Fetch user to get full name for activity log
      const user = await User.findByPk(userId);
      const fullName = user
        ? `${user.firstname || ""} ${user.lastname || ""}`.trim()
        : null;

      await logActivity(
        userId,
        "update",
        `Lead updated with ID ${lead.id}`,
        fullName || undefined,
      );
      await sendNotification(userId, `Lead updated with ID ${lead.id}`);
    }

    return { ...(lead.toJSON() as any) };
  } catch (error: any) {
    throw new Error(`Error updating lead: ${error.message}`);
  }
};

export const deleteLead = async (
  id: number,
  userId?: number,
): Promise<void> => {
  try {
    const lead = await Lead.findByPk(id);
    if (!lead) {
      throw new Error("Lead not found");
    }

    await lead.destroy();

    if (userId) {
      // Fetch user to get full name for activity log
      const user = await User.findByPk(userId);
      const fullName = user
        ? `${user.firstname || ""} ${user.lastname || ""}`.trim()
        : null;

      await logActivity(
        userId,
        "delete",
        `Lead deleted with ID ${id}`,
        fullName || undefined,
      );
      await sendNotification(userId, `Lead deleted with ID ${id}`);
    }
  } catch (error: any) {
    throw new Error(`Error deleting lead: ${error.message}`);
  }
};

const BULK_DELETE_LEADS_MAX = 1000;

export const bulkDeleteLeads = async (
  leadIds: number[],
  userId?: number,
): Promise<{ deletedCount: number }> => {
  const cleanIds = [
    ...new Set(
      (leadIds || [])
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && id > 0),
    ),
  ];

  if (cleanIds.length === 0) {
    return { deletedCount: 0 };
  }

  if (cleanIds.length > BULK_DELETE_LEADS_MAX) {
    throw new Error(
      `At most ${BULK_DELETE_LEADS_MAX} leads can be deleted per request`,
    );
  }

  const rows = await Lead.findAll({
    where: { id: { [Op.in]: cleanIds } },
    attributes: ["id", "assignees"],
  });

  const deletableIds = rows
    .filter((lead) => {
      const raw = (lead as any).assignees;
      if (raw == null) return true;
      if (Array.isArray(raw)) return raw.length === 0;
      if (typeof raw === "string") {
        try {
          const parsed = JSON.parse(raw);
          return !Array.isArray(parsed) || parsed.length === 0;
        } catch {
          return true;
        }
      }
      return false;
    })
    .map((lead) => Number((lead as any).id))
    .filter((id) => Number.isInteger(id) && id > 0);

  if (deletableIds.length === 0) {
    return { deletedCount: 0 };
  }

  const deletedCount = await Lead.destroy({
    where: { id: { [Op.in]: deletableIds } },
  });

  if (userId && deletedCount > 0) {
    const user = await User.findByPk(userId);
    const fullName = user
      ? `${user.firstname || ""} ${user.lastname || ""}`.trim()
      : undefined;
    await logActivity(
      userId,
      "delete",
      `Bulk deleted ${deletedCount} unassigned lead(s)`,
      fullName || undefined,
    );
    await sendNotification(
      userId,
      `Bulk deleted ${deletedCount} unassigned lead(s)`,
    );
  }

  return { deletedCount };
};
export const assignLeadToUsers = async (
  leadId: number,
  userIdsToAssign: number[],
  assignedByUserId?: number,
): Promise<LeadAttributes> => {
  try {
    // 🔹 Fetch Lead
    const lead = await Lead.findByPk(leadId);
    if (!lead) {
      throw new Error("Lead not found");
    }

    // 🔹 Normalize existing assignees
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

    const existingIds = new Set(currentAssignees.map((a) => a.userId));
    const assignmentTimestamp = new Date().toISOString();

    // 🔹 Prepare new assignees
    const newAssignees: AssigneeWithStatus[] = userIdsToAssign
      .filter((id) => !existingIds.has(id))
      .map((id) => ({
        userId: id,
        status: "pending",
        assignedAt: assignmentTimestamp,
        status_updated: false,
      }));

    if (newAssignees.length === 0) {
      throw new Error("All provided users are already assigned to this lead.");
    }

    // 🔹 Update lead
    await lead.update({
      assignees: [...currentAssignees, ...newAssignees],
    });

    // 🔹 Fetch assigner name once
    let assignerName: string | undefined;

    if (assignedByUserId) {
      const assigner = await User.findByPk(assignedByUserId, {
        attributes: ["firstname", "lastname"],
      });

      assignerName = assigner
        ? `${assigner.firstname || ""} ${assigner.lastname || ""}`.trim()
        : undefined;
    }

    // 🔹 Log activity + notify assignees
    if (assignedByUserId) {
      for (const newUser of newAssignees) {
        // Fetch assignee name
        const assignee = await User.findByPk(newUser.userId, {
          attributes: ["firstname", "lastname"],
        });

        const assigneeName = assignee
          ? `${assignee.firstname || ""} ${assignee.lastname || ""}`.trim()
          : `User ID ${newUser.userId}`;

        // Activity log (HUMAN READABLE)
        await logActivity(
          assignedByUserId,
          "assign",
          `Assigned lead ${lead.leadCode} to ${assigneeName}`,
          assignerName,
        );

        // Notification
        await sendNotification(
          newUser.userId,
          `You have been assigned lead ${lead.leadCode}`,
        );

        // Send Email
        try {
          const assigneeUser = await User.findByPk(newUser.userId, {
            attributes: ["email", "firstname", "lastname"],
          });

          if (assigneeUser?.email) {
            const { subject, html } = leadAssignmentTemplate({
              userName:
                `${assigneeUser.firstname || ""} ${assigneeUser.lastname || ""}`.trim() ||
                "User",
              leadCode: lead.leadCode,
              assignedBy: assignerName,
              campaignName: lead.campaignName,
            });

            const smtpConfig = await getSmtpConfig(
              assignedByUserId || newUser.userId,
            );
            await sendEmail({
              smtp: smtpConfig,
              to: assigneeUser.email,
              subject,
              body: html,
            });
          }
        } catch (emailError) {
          console.error("Error sending lead assignment email:", emailError);
        }
      }
    }

    return lead.toJSON() as LeadAttributes;
  } catch (error: any) {
    throw new Error(`Error assigning lead: ${error.message}`);
  }
};

export const bulkAssignLeadsToUser = async (
  leadIds: number[],
  userId: number,
  assignedByUserId?: number,
): Promise<{ success: number; failed: number; results: any[] }> => {
  try {
    if (!leadIds || leadIds.length === 0) {
      throw new Error("No lead IDs provided");
    }

    if (!userId) {
      throw new Error("User ID is required");
    }

    // Fetch the assignee user once
    const assignee = await User.findByPk(userId, {
      attributes: ["id", "firstname", "lastname", "email"],
    });

    if (!assignee) {
      throw new Error("Assignee user not found");
    }

    const assigneeName =
      `${assignee.firstname || ""} ${assignee.lastname || ""}`.trim() ||
      `User ID ${userId}`;

    // Fetch the assigner user once (if provided)
    let assignerName: string | undefined;
    if (assignedByUserId) {
      const assigner = await User.findByPk(assignedByUserId, {
        attributes: ["firstname", "lastname"],
      });
      assignerName = assigner
        ? `${assigner.firstname || ""} ${assigner.lastname || ""}`.trim()
        : undefined;
    }

    const assignmentTimestamp = new Date().toISOString();
    const results: any[] = [];
    let successCount = 0;
    let failCount = 0;

    // Process each lead
    for (const leadId of leadIds) {
      try {
        const lead = await Lead.findByPk(leadId);
        if (!lead) {
          results.push({ leadId, success: false, error: "Lead not found" });
          failCount++;
          continue;
        }

        // Normalize existing assignees
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

        // Check if user is already assigned
        const existingIds = new Set(currentAssignees.map((a) => a.userId));
        if (existingIds.has(userId)) {
          results.push({
            leadId,
            success: false,
            error: "User already assigned",
          });
          failCount++;
          continue;
        }

        // Add new assignee
        const newAssignee: AssigneeWithStatus = {
          userId: userId,
          status: "pending",
          assignedAt: assignmentTimestamp,
        };

        await lead.update({
          assignees: [...currentAssignees, newAssignee],
        });

        results.push({ leadId, success: true });
        successCount++;

        // NOTE: do not send per-lead notifications here (bulk assign should send a single summary)
      } catch (error: any) {
        results.push({ leadId, success: false, error: error.message });
        failCount++;
      }
    }

    // Log a single activity for bulk assignment
    if (assignedByUserId && successCount > 0) {
      // Single notification for bulk assignment (prevents 300 notifications for 300 leads)
      await sendNotification(
        userId,
        `You have been assigned ${successCount} lead${successCount !== 1 ? "s" : ""}${assignerName ? ` by ${assignerName}` : ""}.`,
      );

      await logActivity(
        assignedByUserId,
        "assign",
        `${successCount} lead${successCount !== 1 ? "s" : ""} assigned to ${assigneeName}`,
        assignerName,
      );

      // Send bulk assignment email
      try {
        if (assignee?.email) {
          const { subject, html } = leadAssignmentTemplate({
            userName: assigneeName,
            leadCode: "",
            leadCount: successCount,
            assignedBy: assignerName,
          });

          const smtpConfig = await getSmtpConfig(assignedByUserId);
          await sendEmail({
            smtp: smtpConfig,
            to: assignee.email,
            subject,
            body: html,
          });
        }
      } catch (emailError) {
        console.error("Error sending bulk lead assignment email:", emailError);
      }
    }

    return {
      success: successCount,
      failed: failCount,
      results,
    };
  } catch (error: any) {
    throw new Error(`Error bulk assigning leads: ${error.message}`);
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
  assignmentState?: "all" | "assigned" | "unassigned";
  contactState?: "all" | "present" | "missing";
  /** When true, only leads that were promoted from incoming_leads (staging → leads). */
  onlyPromotedFromIncoming?: boolean;
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
  userId, // Add userId parameter to filter by creator
  isAdmin = false, // Add isAdmin flag
}: {
  page?: number;
  limit?: number;
  search?: string;
  campaign?: string;
  filterType?: FilterType;
  startDate?: string;
  endDate?: string;
  conditions?: any[]; // ← added
  userId?: number;
  isAdmin?: boolean;
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
      whereConditions[Op.and].push(
        Sequelize.where(
          Sequelize.fn("LOWER", Sequelize.col("campaignName")),
          campaign.trim().toLowerCase(),
        ),
      );
    }
    // ─────────────────────────────────────────
    // Date filter
    // ─────────────────────────────────────────
    if (filterType) {
      const dateFilter = buildDateFilter(filterType, startDate, endDate);
      // Only add date filter if it has actual conditions (check for createdAt property)
      if (dateFilter && "createdAt" in dateFilter) {
        console.log("📅 Applying date filter:", {
          filterType,
          startDate,
          endDate,
          dateFilter,
        });
        whereConditions[Op.and].push(dateFilter);
      } else {
        console.log("⚠️ Date filter returned empty object:", {
          filterType,
          startDate,
          endDate,
        });
      }
    }
    // ─────────────────────────────────────────
    // ⭐ Dynamic JSON field filtering (main part)
    // ─────────────────────────────────────────
    if (conditions.length > 0) {
      const dynamicFilter = buildDynamicFilters(conditions);
      whereConditions[Op.and].push(dynamicFilter);
    }
    // ─────────────────────────────────────────
    // Filter by creator if user is not admin (datascrapper and other non-admin roles)
    // Non-admin users should only see leads they created themselves
    // ─────────────────────────────────────────
    if (!isAdmin && userId) {
      whereConditions[Op.and].push({ createdBy: userId });
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
              (a) => a.userId === user.id || a === user.id,
            );
            return {
              ...user.toJSON(),
              status: assignment?.status || "pending",
            };
          });
        }
        const leadCode = buildLeadCodeFromCampaignAndId(
          lead.campaignName || "",
          Number(lead.id),
        );

        return {
          ...(lead.toJSON() as any),
          assignees: assigneesData,
          leadCode: leadCode, // Add leadCode to the enriched lead object
        };
      }),
    );
    // ─────────────────────────────────────────
    // GLOBAL SEARCH across all fields (including leadCode)
    // ─────────────────────────────────────────
    const filteredLeads =
      search && search.trim() !== ""
        ? enrichedLeads.filter((lead) =>
            leadEnrichedRowMatchesSearch(lead as Record<string, unknown>, search),
          )
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
  userId, // Add userId parameter to filter by creator
  isAdmin = false, // Add isAdmin flag
  isManager = false, // Add isManager flag
  managerBrandUserIds = [], // User IDs under brands managed by this manager
}: GetUnassignedLeadsParams & {
  conditions?: any[];
  userId?: number;
  isAdmin?: boolean;
  isManager?: boolean;
  managerBrandUserIds?: number[];
}) => {
  try {
    // STEP 1: Build base where condition for unassigned leads
    const whereCondition: any = {
      [Op.and]: [
        Sequelize.literal("(assignees IS NULL OR JSON_LENGTH(assignees) = 0)"),
      ],
    };
    // STEP 2: Campaign filter
    if (campaign && campaign.trim() !== "") {
      whereCondition[Op.and].push(
        Sequelize.where(
          Sequelize.fn("LOWER", Sequelize.col("campaignName")),
          campaign.trim().toLowerCase(),
        ),
      );
    }
    // STEP 3: Date filter
    if (filterType) {
      const dateFilter = buildDateFilter(filterType, startDate, endDate);
      // Only add date filter if it has actual conditions (check for createdAt property)
      if (dateFilter && "createdAt" in dateFilter) {
        console.log("📅 Applying date filter (unassigned):", {
          filterType,
          startDate,
          endDate,
          dateFilter,
        });
        whereCondition[Op.and].push(dateFilter);
      } else {
        console.log("⚠️ Date filter returned empty object (unassigned):", {
          filterType,
          startDate,
          endDate,
        });
      }
    }
    // STEP 4: Dynamic JSON field filtering
    if (conditions.length > 0) {
      const dynamicFilter = buildDynamicFilters(conditions);
      whereCondition[Op.and].push(dynamicFilter);
    }
    // STEP 4.5: Filter by creator if user is not admin and not a manager
    // Managers see all unassigned leads (master leads)
    // Non-admin users should only see leads they created themselves
    if (isManager) {
      // Managers see all unassigned leads - no restriction
    } else if (!isAdmin && userId) {
      whereCondition[Op.and].push({ createdBy: userId });
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

        const leadCode = buildLeadCodeFromCampaignAndId(
          lead.campaignName || "",
          Number(lead.id),
        );

        return {
          ...plainLead,
          assignees: assigneesData,
          leadCode: leadCode, // Add leadCode to the enriched lead object
        };
      }),
    );
    // STEP 7: GLOBAL SEARCH across all fields (including leadCode)
    const filteredLeads =
      searchTerm && searchTerm.trim() !== ""
        ? enrichedLeads.filter((lead) =>
            leadEnrichedRowMatchesSearch(
              lead as Record<string, unknown>,
              searchTerm,
            ),
          )
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
      `JSON_UNQUOTE(JSON_EXTRACT(leadData, '$.${field}'))`,
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

/** Match getLeadsByAssigneeId / DB: trim, lower, collapse spaces. */
const normalizeCampaignNameForApi = (value?: string) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

async function resolveEffectiveCampaignNameFromQuery(
  campaignName?: string,
  campaignId?: number,
): Promise<string> {
  let effective = campaignName?.trim() || "";
  if (campaignId && !isNaN(Number(campaignId))) {
    const campaignRecord = await Campaign.findByPk(Number(campaignId), {
      attributes: ["campaignName"],
    });
    if (campaignRecord?.campaignName) {
      effective = String(campaignRecord.campaignName).trim();
    }
  }
  return effective;
}

export const getLeadsByAssigneeId = async (
  assigneeId: number,
  filterType?: FilterType,
  startDate?: string,
  endDate?: string,
  page: number = 1,
  limit: number = 10,
  campaignName?: string,
  campaignId?: number,
  search?: string,
  conditions: any[] = [],
) => {
  try {
    const { offset } = getPagination({ page, limit });

    // Build the base query with JSON search for assignee
    const baseWhereClause: any = {
      [Op.and]: Sequelize.literal(
        `JSON_CONTAINS(assignees, '{"userId": ${assigneeId}}', '$')`,
      ),
    };

    // Resolve campaign filter from campaignId first (source of truth).
    // Falls back to campaignName when ID is not provided.
    const effectiveCampaignName = await resolveEffectiveCampaignNameFromQuery(
      campaignName,
      campaignId,
    );

    // Add campaign filter if provided (trim + lower + collapse spaces, match DB trim)
    if (effectiveCampaignName) {
      const normalizedCampaignName = normalizeCampaignNameForApi(effectiveCampaignName);
      baseWhereClause[Op.and] = Sequelize.and(
        baseWhereClause[Op.and],
        Sequelize.where(
          Sequelize.fn(
            "LOWER",
            Sequelize.fn("TRIM", Sequelize.col("campaignName")),
          ),
          normalizedCampaignName,
        ),
      );
    }

    // STEP 1: Get all leads matching base filters
    let allLeads = await Lead.findAll({
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

    // Defensive post-query guard: ensure no similarly named campaign leaks
    // through due to DB collation or environment differences.
    if (effectiveCampaignName) {
      const normalizedRequestedCampaign = normalizeCampaignNameForApi(
        effectiveCampaignName,
      );
      allLeads = allLeads.filter(
        (lead: any) =>
          normalizeCampaignNameForApi(lead?.campaignName) ===
          normalizedRequestedCampaign,
      );
    }

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
        (a) => Number(a.userId) === assigneeId,
      );
      if (!userAssignment) return false;

      const assignmentDate = userAssignment.assignedAt
        ? DateTime.fromISO(userAssignment.assignedAt, { zone: "Asia/Karachi" }) // FIXED monthly filter issue
        : DateTime.fromJSDate(lead.createdAt).setZone("Asia/Karachi");

      // Apply date filters based on PST (skip if filterType is undefined/null)
      if (!filterType) {
        return true; // No date filtering - show all records
      }

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

    // STEP 2.5: Apply search filter (leadData, campaignName, leadCode)
    let searchedLeads = filteredLeads;
    if (search && search.trim() !== "") {
      searchedLeads = filteredLeads.filter((lead: any) =>
        leadPartialRowMatchesSearch(lead, search),
      );
    }

    // STEP 2.6: Apply conditions filter (from LeadFilterModal)
    if (conditions && conditions.length > 0) {
      const evaluateCondition = (
        value: any,
        condition: string,
        target: string,
      ) => {
        const val = String(value ?? "").toLowerCase();
        const tgt = String(target ?? "").toLowerCase();

        switch (condition) {
          case "equals":
            return val === tgt;
          case "notEquals":
            return val !== tgt;
          case "contains":
            return val.includes(tgt);
          case "notContains":
            return !val.includes(tgt);
          case "isBlank":
            return val.trim() === "";
          case "isNotBlank":
            return val.trim() !== "";
          default:
            return true;
        }
      };

      searchedLeads = searchedLeads.filter((lead: any) => {
        let leadData: any = lead.leadData;
        if (typeof leadData === "string") {
          try {
            leadData = JSON.parse(leadData);
          } catch {
            leadData = {};
          }
        }

        return conditions.reduce((acc, condition, index) => {
          const fieldVal = leadData?.[condition.field];
          const match = evaluateCondition(
            fieldVal,
            condition.condition,
            condition.value,
          );

          if (index === 0) return match;
          return condition.joinType === "OR" ? acc || match : acc && match;
        }, true as boolean);
      });
    }

    // STEP 3: Apply pagination
    const totalCount = searchedLeads.length;
    const paginatedLeads = searchedLeads.slice(offset, offset + limit);

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
        (a) => Number(a.userId) === assigneeId,
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
      `Error fetching leads for assignee ID ${assigneeId}: ${error.message}`,
    );
  }
};

export const sendEmailToLeadUsingTemplate = async (
  leadId: number,
  templateKey: string,
  senderUserId: number,
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

export const getLeadStatusSummary = async (
  assigneeId?: number,
  period?: string,
  startDate?: string,
  endDate?: string,
  campaignName?: string,
  campaignId?: number,
) => {
  try {
    const effectiveCampaignName = await resolveEffectiveCampaignNameFromQuery(
      campaignName,
      campaignId,
    );
    const normalizedCampaignFilter = effectiveCampaignName
      ? normalizeCampaignNameForApi(effectiveCampaignName)
      : "";

    /** Must match assignee `status` values on Lead (see `lead.model` ALLOWED_STATUSES). */
    const statuses = [
      "pending",
      "to_call",
      "interested",
      "most_interested",
      "sold",
      "not_answered",
      "not_interested",
      "hot_lead",
      "lead_rejected",
    ] as const;
    const statusCounts: Record<string, number> = {};
    const leadsByStatus: Record<string, any[]> = {};

    const periodLower = period?.trim().toLowerCase() ?? "";
    const activityAlignedPeriods = [
      "daily",
      "weekly",
      "monthly",
      "custom",
    ] as const;

    if (
      assigneeId &&
      periodLower &&
      (activityAlignedPeriods as readonly string[]).includes(periodLower)
    ) {
      const filterArgs: Record<string, any> =
        periodLower === "custom" && startDate && endDate
          ? { startDate, endDate }
          : {};

      const periodCounts = await getStatusCountsForUserActivityPeriod(
        assigneeId,
        periodLower as (typeof activityAlignedPeriods)[number],
        filterArgs,
      );

      let { statusCounts: alignedCounts, leadsByStatus: alignedLeads } =
        periodCounts;

      if (normalizedCampaignFilter) {
        for (const status of statuses) {
          alignedLeads[status] = (alignedLeads[status] || []).filter((lead) => {
            const name = String(lead?.campaignName ?? "")
              .trim()
              .toLowerCase();
            return name === normalizedCampaignFilter;
          });
          alignedCounts[status] = alignedLeads[status].length;
        }
      }

      return {
        statusCounts: alignedCounts,
        leadsByStatus: alignedLeads,
      };
    }

    const resolvePeriodRange = () => {
      const now = DateTime.now().setZone(PKT_ZONE);

      if (period === "custom" && startDate && endDate) {
        const s = DateTime.fromISO(startDate, { zone: PKT_ZONE });
        const e = DateTime.fromISO(endDate, { zone: PKT_ZONE });
        if (s.isValid && e.isValid) {
          return {
            start: s.startOf("day").toJSDate(),
            end: e.endOf("day").toJSDate(),
          };
        }
      }

      if (period === "daily") {
        const { start, end } = getPktShiftDailyWindow(now);
        return { start: start.toJSDate(), end: end.toJSDate() };
      }

      if (period === "weekly") {
        const { start, end } = getPktWeeklyShiftWindow(now);
        return { start: start.toJSDate(), end: end.toJSDate() };
      }

      if (period === "monthly") {
        const { start, end } = getPktMonthlyShiftWindow(now);
        return { start: start.toJSDate(), end: end.toJSDate() };
      }

      return null;
    };

    const periodRange = resolvePeriodRange();

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

      const whereParts: any[] = [whereCondition];
      if (normalizedCampaignFilter) {
        whereParts.push(
          Sequelize.where(
            Sequelize.fn(
              "LOWER",
              Sequelize.fn("TRIM", Sequelize.col("campaignName")),
            ),
            normalizedCampaignFilter,
          ),
        );
      }
      const leads = await Lead.findAll({
        where:
          whereParts.length === 1 ? whereParts[0] : { [Op.and]: whereParts },
        order: [["createdAt", "DESC"]],
      });

      const filteredLeads = !periodRange
        ? leads
        : leads.filter((lead: any) => {
            let referenceDate: Date | null = null;

            if (assigneeId) {
              try {
                const assignees =
                  typeof lead.assignees === "string"
                    ? JSON.parse(lead.assignees)
                    : Array.isArray(lead.assignees)
                      ? lead.assignees
                      : [];

                const assigneeEntry = assignees.find(
                  (a: any) =>
                    Number(a?.userId) === Number(assigneeId) &&
                    String(a?.status || "").toLowerCase() === status,
                );
                if (assigneeEntry?.assignedAt) {
                  const d = new Date(assigneeEntry.assignedAt);
                  if (!Number.isNaN(d.getTime())) referenceDate = d;
                }
              } catch {
                // ignore parse failures; fallback below
              }
            }

            if (!referenceDate) {
              const fallback = new Date(lead.updatedAt || lead.createdAt);
              if (!Number.isNaN(fallback.getTime())) referenceDate = fallback;
            }
            if (!referenceDate) return false;

            return (
              referenceDate >= periodRange.start &&
              referenceDate <= periodRange.end
            );
          });

      statusCounts[status] = filteredLeads.length;
      leadsByStatus[status] = filteredLeads.map((lead) => ({
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
  "not_answered",
  "not_interested",
  "hot_lead",
  "lead_rejected",
];

export type LeadStatus =
  | "pending"
  | "to_call"
  | "interested"
  | "most_interested"
  | "sold"
  | "not_answered"
  | "not_interested"
  | "do_not_call"
  | "hot_lead"
  | "lead_rejected";

type HotLeadRequestStatus = "pending" | "approved" | "rejected";
type AssigneeWithHotLeadMeta = AssigneeWithStatus & {
  hotLeadRequestStatus?: HotLeadRequestStatus | null;
  hotLeadPreviousStatus?: LeadStatus | null;
  hotLeadRequestedAt?: string | null;
  hotLeadRequestComment?: string | null;
  hotLeadReviewReason?: string | null;
  hotLeadReviewedAt?: string | null;
  hotLeadReviewedBy?: number | null;
  hotLeadRejectReason?: string | null;
};

// export const updateLeadStatusForUser = async (
//   leadId: number,
//   userId: number,
//   newStatus: LeadStatus,
// ) => {
//   if (!ALLOWED_STATUSES.includes(newStatus)) {
//     throw new Error(
//       `Invalid status. Allowed statuses: ${ALLOWED_STATUSES.join(", ")}`,
//     );
//   }

//   const lead = await Lead.findByPk(leadId);
//   if (!lead) {
//     throw new Error(`Lead with ID ${leadId} not found`);
//   }

//   let assignees: AssigneeWithStatus[] = [];

//   try {
//     if (Array.isArray(lead.assignees)) {
//       assignees = lead.assignees;
//     } else if (typeof lead.assignees === "string") {
//       assignees = JSON.parse(lead.assignees);
//     } else if (lead.assignees && typeof lead.assignees === "object") {
//       assignees = lead.assignees as AssigneeWithStatus[];
//     }
//   } catch (err) {
//     assignees = [];
//   }

//   const index = assignees.findIndex((a) => Number(a.userId) === Number(userId));

//   if (index === -1) {
//     throw new Error(`User ID ${userId} is not assigned to lead ID ${leadId}`);
//   }

//   const previousStatus = assignees[index].status;
//   assignees[index].status = newStatus;

//   await lead.update({ assignees });

//   try {
//     const logResult = await logLeadActivity({
//       entityId: leadId,
//       entityType: "lead",
//       action: "status_updated",
//       performedBy: userId,
//       details: `Status changed from "${previousStatus}" to "${newStatus}"`,
//     });
//   } catch (err) {}

//   return { ...(lead.toJSON() as any) };
// };

// Service: updateLeadStatusForUser (UPDATED)\

export const updateLeadStatusForUser = async (
  leadId: number,
  userId: number,
  newStatus: LeadStatus,
  hotLeadComment?: string,
) => {
  if (!ALLOWED_STATUSES.includes(newStatus)) {
    throw new Error(
      `Invalid status. Allowed statuses: ${ALLOWED_STATUSES.join(", ")}`,
    );
  }

  const lead = await Lead.findByPk(leadId);
  if (!lead) {
    throw new Error(`Lead with ID ${leadId} not found`);
  }

  let parsedAssignees: AssigneeWithHotLeadMeta[] = [];
  try {
    if (Array.isArray(lead.assignees)) {
      parsedAssignees = lead.assignees as AssigneeWithHotLeadMeta[];
    } else if (typeof lead.assignees === "string") {
      parsedAssignees = JSON.parse(lead.assignees);
    } else if (lead.assignees && typeof lead.assignees === "object") {
      parsedAssignees = lead.assignees as AssigneeWithHotLeadMeta[];
    }
  } catch {
    parsedAssignees = [];
  }

  // Clone so Sequelize sees a new JSON reference
  const assignees = parsedAssignees.map((a) => ({ ...a }));

  const index = assignees.findIndex((a) => Number(a.userId) === Number(userId));
  if (index === -1) {
    throw new Error(`User ID ${userId} is not assigned to lead ID ${leadId}`);
  }

  const previousStatus = assignees[index].status;
  const cleanHotLeadComment = String(hotLeadComment || "").trim();

  const nowIso = new Date().toISOString();
  const updatedAssignees = assignees.map((a, i) => {
    if (i !== index) return a;
    if (newStatus === "hot_lead") {
      const fallbackPreviousStatus: LeadStatus =
        previousStatus === "hot_lead"
          ? (a.hotLeadPreviousStatus as LeadStatus | undefined) || "pending"
          : previousStatus;
      return {
        ...a,
        status: "hot_lead",
        hotLeadRequestStatus: "pending" as HotLeadRequestStatus,
        hotLeadPreviousStatus: fallbackPreviousStatus,
        hotLeadRequestedAt: nowIso,
        hotLeadRequestComment: cleanHotLeadComment || null,
        hotLeadReviewedAt: null,
        hotLeadReviewedBy: null,
        hotLeadRejectReason: null,
      };
    }
    return {
      ...a,
      status: newStatus,
      hotLeadRequestStatus: null,
      hotLeadPreviousStatus: null,
      hotLeadRequestedAt: null,
      hotLeadRequestComment: null,
      hotLeadReviewedAt: null,
      hotLeadReviewedBy: null,
      hotLeadRejectReason: null,
    };
  });

  // Force change detection for JSON column
  lead.set("assignees", updatedAssignees as any);
  lead.changed("assignees", true);
  await lead.save();

  try {
    await logLeadActivity({
      entityId: leadId,
      entityType: "lead",
      action: "status_updated",
      performedBy: userId,
      details:
        newStatus === "hot_lead" && cleanHotLeadComment
          ? `Status changed from "${previousStatus}" to "${newStatus}" (comment: ${cleanHotLeadComment})`
          : `Status changed from "${previousStatus}" to "${newStatus}"`,
    });
  } catch (err) {}

  if (newStatus === "hot_lead") {
    try {
      // Auto-lock hot-lead request with the requesting assignee.
      // If already locked by someone else, move lock ownership to requester.
      const now = new Date();
      const activeLock = await LeadLock.findOne({
        where: {
          leadId,
          status: "locked",
          [Op.or]: [{ lockUntil: null }, { lockUntil: { [Op.gt]: now } }],
        } as any,
      });
      if (!activeLock) {
        await LeadLock.create({
          leadId,
          lockedByUserId: userId,
          status: "locked",
          reason: "Auto-lock on hot lead request",
          lockedAt: now,
          lockUntil: null,
          unlockedAt: null,
        } as any);
      } else if (Number((activeLock as any).lockedByUserId) !== Number(userId)) {
        await activeLock.update({
          lockedByUserId: userId,
          status: "locked",
          reason: "Auto-lock moved to hot lead requester",
          lockUntil: null,
          unlockedAt: null,
        } as any);
      }

      const managerIds = await getBrandManagerIdsForUser(userId);
      if (managerIds.length > 0) {
        const requester = await User.findByPk(userId, {
          attributes: ["firstname", "lastname"],
        });
        const reqName =
          requester &&
          `${requester.firstname || ""} ${requester.lastname || ""}`.trim().length > 0
            ? `${requester.firstname || ""} ${requester.lastname || ""}`.trim()
            : `User ${userId}`;
        const camp = String((lead as any).campaignName || "").trim().slice(0, 120);
        const msgBase =
          `${reqName} requested hot lead approval · Lead #${leadId}` +
          (camp ? ` (${camp})` : "");
        const message = msgBase.slice(0, 255);
        const socketPayload = {
          type: "hot_lead_request" as const,
          leadId,
          requesterUserId: userId,
          campaignName: camp || null,
        };
        await Promise.all(
          managerIds.map(async (mid) => {
            await sendNotification(mid, message, reqName, socketPayload);
            emitSocketToUser(mid, "hot_lead_request", {
              ...socketPayload,
              message,
              requesterName: reqName,
            });
          }),
        );
      }
    } catch (_) {}
  }

  return { ...(lead.toJSON() as any) };
};

const extractAssignees = (lead: Lead): AssigneeWithHotLeadMeta[] => {
  try {
    if (Array.isArray(lead.assignees)) return lead.assignees as AssigneeWithHotLeadMeta[];
    if (typeof lead.assignees === "string") return JSON.parse(lead.assignees);
    if (lead.assignees && typeof lead.assignees === "object") {
      return lead.assignees as AssigneeWithHotLeadMeta[];
    }
  } catch {
    return [];
  }
  return [];
};

const saveAssignees = async (lead: Lead, assignees: AssigneeWithHotLeadMeta[]) => {
  lead.set("assignees", assignees as any);
  lead.changed("assignees", true);
  await lead.save();
};

const resolveHotLeadDateRange = (
  filterType?: string,
  startDate?: string,
  endDate?: string,
): { start?: Date; end?: Date } | null => {
  const normalized = String(filterType || "").trim().toLowerCase();
  if (!normalized || normalized === "all") return null;
  const mappedFilterType =
    normalized === "weekend"
      ? "weekly"
      : normalized === "month"
        ? "monthly"
        : normalized;
  const built = buildDateFilter(
    mappedFilterType as FilterType,
    startDate,
    endDate,
  ) as any;
  const createdAtFilter = built?.createdAt;
  if (!createdAtFilter || typeof createdAtFilter !== "object") return null;
  if (createdAtFilter[Op.between]) {
    const [s, e] = createdAtFilter[Op.between];
    return { start: s, end: e };
  }
  if (createdAtFilter[Op.gte] || createdAtFilter[Op.lte]) {
    return { start: createdAtFilter[Op.gte], end: createdAtFilter[Op.lte] };
  }
  return null;
};

const inHotLeadDateRange = (
  row: any,
  range: { start?: Date; end?: Date } | null,
): boolean => {
  if (!range) return true;
  const raw = row?.hotLeadRequestedAt || row?.hotLeadReviewedAt;
  if (!raw) return false;
  const dt = new Date(raw);
  if (Number.isNaN(dt.getTime())) return false;
  if (range.start && dt < range.start) return false;
  if (range.end && dt > range.end) return false;
  return true;
};

/** Substring match (case-insensitive) on visible hot-lead row fields. */
const filterHotLeadRowsBySearch = <
  T extends {
    campaignName?: string | null;
    leadCode?: string | null;
    leadId?: number | null;
    hotLeadRequestComment?: string | null;
    hotLeadReviewReason?: string | null;
    hotLeadRejectReason?: string | null;
    user?: { firstname?: string; lastname?: string; email?: string } | null;
  },
>(
  rows: T[],
  search?: string | null,
): T[] => {
  const q = String(search ?? "").trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((row) => {
    const blobs = [
      row.campaignName,
      row.leadCode,
      row.leadId != null ? String(row.leadId) : "",
      row.hotLeadRequestComment,
      row.hotLeadReviewReason,
      row.hotLeadRejectReason,
      row.user?.firstname,
      row.user?.lastname,
      row.user?.email,
    ];
    return blobs.some((b) => String(b || "").toLowerCase().includes(q));
  });
};

export const getManagerHotLeadRequests = async ({
  managerId,
  page = 1,
  limit = 10,
  campaignName,
  campaignId,
  leadId: leadIdFilter,
  /** pending = inbox awaiting manager action; reviewed = approved/rejected history; all = both */
  reviewState = "pending",
  scopeAll = false,
  filterType,
  startDate,
  endDate,
  filterUserId,
  search,
}: {
  managerId: number;
  page?: number;
  limit?: number;
  campaignName?: string;
  campaignId?: number;
  leadId?: number;
  reviewState?: "pending" | "reviewed" | "all";
  scopeAll?: boolean;
  filterType?: string;
  startDate?: string;
  endDate?: string;
  filterUserId?: number;
  search?: string | null;
}) => {
  const managedUserIds = scopeAll ? [] : await getManagerBrandUserIds(managerId);
  if (!scopeAll && managedUserIds.length === 0) {
    return { rows: [], totalItems: 0, totalPages: 0, currentPage: page, pageSize: limit };
  }

  const effectiveCampaignName = await resolveEffectiveCampaignNameFromQuery(
    campaignName,
    campaignId,
  );
  const normalizedCampaign = effectiveCampaignName
    ? normalizeCampaignNameForApi(effectiveCampaignName)
    : "";

  const pendingLiteral = literal(
    `JSON_SEARCH(assignees, 'one', 'pending', NULL, '$[*].hotLeadRequestStatus') IS NOT NULL`,
  );
  const reviewedLiteral = literal(
    `(JSON_SEARCH(assignees, 'one', 'approved', NULL, '$[*].hotLeadRequestStatus') IS NOT NULL OR JSON_SEARCH(assignees, 'one', 'rejected', NULL, '$[*].hotLeadRequestStatus') IS NOT NULL)`,
  );

  let hotMetaWhere: any;
  if (reviewState === "pending") {
    hotMetaWhere = pendingLiteral;
  } else if (reviewState === "reviewed") {
    hotMetaWhere = reviewedLiteral;
  } else {
    hotMetaWhere = { [Op.or]: [pendingLiteral, reviewedLiteral] };
  }

  const leadWhereParts: any[] = [hotMetaWhere];
  if (normalizedCampaign) {
    leadWhereParts.push(
      Sequelize.where(
        Sequelize.fn("LOWER", Sequelize.fn("TRIM", Sequelize.col("campaignName"))),
        normalizedCampaign,
      ),
    );
  }
  if (leadIdFilter != null && !Number.isNaN(Number(leadIdFilter))) {
    leadWhereParts.push({ id: Number(leadIdFilter) });
  }

  const candidateLeads = await Lead.findAll({
    where:
      leadWhereParts.length === 1
        ? leadWhereParts[0]
        : { [Op.and]: leadWhereParts },
    order: [["updatedAt", "DESC"]],
  });

  const rows: any[] = [];
  for (const lead of candidateLeads) {
    const assignees = extractAssignees(lead);
    for (const assignee of assignees) {
      if (!scopeAll && !managedUserIds.includes(Number(assignee.userId))) continue;
      if (filterUserId != null && Number(assignee.userId) !== Number(filterUserId)) continue;

      const hrs = assignee.hotLeadRequestStatus;
      let include = false;
      if (reviewState === "pending") {
        include = hrs === "pending" && assignee.status === "hot_lead";
      } else if (reviewState === "reviewed") {
        include = hrs === "approved" || hrs === "rejected";
      } else {
        include =
          (hrs === "pending" && assignee.status === "hot_lead") ||
          hrs === "approved" ||
          hrs === "rejected";
      }
      if (!include) continue;

      rows.push({
        leadId: (lead as any).id,
        leadCode: lead.leadCode,
        campaignName: (lead as any).campaignName,
        leadData: (lead as any).leadData,
        userId: Number(assignee.userId),
        status: assignee.status,
        hotLeadRequestStatus: assignee.hotLeadRequestStatus,
        hotLeadPreviousStatus: assignee.hotLeadPreviousStatus || null,
        hotLeadRequestedAt: assignee.hotLeadRequestedAt || null,
      hotLeadRequestComment: assignee.hotLeadRequestComment || null,
        hotLeadReviewReason: assignee.hotLeadReviewReason || null,
        hotLeadReviewedAt: assignee.hotLeadReviewedAt || null,
        hotLeadReviewedBy: assignee.hotLeadReviewedBy ?? null,
        hotLeadRejectReason: assignee.hotLeadRejectReason || null,
      });
    }
  }

  const userIds = [...new Set(rows.map((r) => r.userId))];
  const users = userIds.length
    ? await User.findAll({
        where: { id: { [Op.in]: userIds } },
        attributes: ["id", "firstname", "lastname", "email"],
      })
    : [];
  const userById = new Map<number, any>(users.map((u: any) => [u.id, u.toJSON()]));

  const enriched = rows.map((r) => ({
    ...r,
    user: userById.get(r.userId) || null,
  }));

  // Newest pending/reviewed requests first so pagination & popup polling see recent items first
  enriched.sort((a, b) => {
    const ta = a.hotLeadRequestedAt
      ? new Date(a.hotLeadRequestedAt as unknown as string).getTime()
      : 0;
    const tb = b.hotLeadRequestedAt
      ? new Date(b.hotLeadRequestedAt as unknown as string).getTime()
      : 0;
    const na = Number.isFinite(ta) ? ta : 0;
    const nb = Number.isFinite(tb) ? tb : 0;
    return nb - na;
  });

  const dateRange = resolveHotLeadDateRange(filterType, startDate, endDate);
  const dateFiltered = dateRange
    ? enriched.filter((row) => inHotLeadDateRange(row, dateRange))
    : enriched;

  const searchFiltered = filterHotLeadRowsBySearch(dateFiltered, search);

  const totalItems = searchFiltered.length;
  const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / limit);
  const start = (page - 1) * limit;
  const statusCounts = searchFiltered.reduce(
    (acc, item) => {
      const status = String(item?.hotLeadRequestStatus || "").toLowerCase().trim();
      if (status === "approved") acc.approved += 1;
      else if (status === "rejected") acc.rejected += 1;
      else acc.pending += 1;
      return acc;
    },
    { pending: 0, approved: 0, rejected: 0 },
  );
  return {
    reviewState,
    rows: searchFiltered.slice(start, start + limit),
    totalItems,
    totalPages,
    currentPage: page,
    pageSize: limit,
    statusCounts,
  };
};

export const reviewHotLeadRequest = async ({
  managerId,
  leadId,
  userId,
  decision,
  rejectReason,
  reviewReason,
  scopeAll = false,
}: {
  managerId: number;
  leadId: number;
  userId: number;
  decision: "approved" | "rejected";
  rejectReason?: string;
  reviewReason?: string;
  scopeAll?: boolean;
}) => {
  const managedUserIds = scopeAll ? [] : await getManagerBrandUserIds(managerId);
  if (!scopeAll && !managedUserIds.includes(userId)) {
    throw new Error("You can only review hot leads for users under your management");
  }

  const lead = await Lead.findByPk(leadId);
  if (!lead) throw new Error("Lead not found");
  const assignees = extractAssignees(lead).map((a) => ({ ...a }));
  const idx = assignees.findIndex((a) => Number(a.userId) === Number(userId));
  if (idx === -1) throw new Error("User is not assigned to this lead");

  const current = assignees[idx];
  if (current.status !== "hot_lead" || current.hotLeadRequestStatus !== "pending") {
    throw new Error("No pending hot lead request found for this user on this lead");
  }

  const nowIso = new Date().toISOString();
  const cleanReviewReason = String(reviewReason || "").trim();
  if (decision === "approved") {
    assignees[idx] = {
      ...current,
      status: "hot_lead",
      hotLeadRequestStatus: "approved",
      hotLeadReviewReason: cleanReviewReason || null,
      hotLeadReviewedBy: managerId,
      hotLeadReviewedAt: nowIso,
      hotLeadRejectReason: null,
    };
  } else {
    assignees[idx] = {
      ...current,
      status: "lead_rejected",
      hotLeadRequestStatus: "rejected",
      hotLeadReviewReason: cleanReviewReason || null,
      hotLeadReviewedBy: managerId,
      hotLeadReviewedAt: nowIso,
      hotLeadRejectReason: rejectReason?.trim() || null,
    };
  }

  await saveAssignees(lead, assignees);

  const requesterUser = await User.findByPk(userId, {
    attributes: ["id", "firstname", "lastname", "email"],
  });
  const requesterName = `${requesterUser?.firstname || ""} ${requesterUser?.lastname || ""}`.trim();
  const requesterLabel =
    requesterName || requesterUser?.email?.trim() || `User #${userId}`;

  if (decision === "rejected") {
    // Auto-unlock on manager rejection so lead can re-enter normal rotation/shuffle.
    const now = new Date();
    await LeadLock.update(
      {
        status: "unlocked",
        unlockedAt: now,
        reason: "Auto-unlocked after manager hot lead rejection",
      } as any,
      {
        where: {
          leadId,
          status: "locked",
          [Op.or]: [{ lockUntil: null }, { lockUntil: { [Op.gt]: now } }],
        } as any,
      },
    );
  }

  await logLeadActivity({
    entityId: leadId,
    entityType: "lead",
    action: "hot_lead_reviewed",
    performedBy: managerId,
    details:
      decision === "approved"
        ? `Hot lead approved for ${requesterLabel} (#${userId})${cleanReviewReason ? ` (reason: ${cleanReviewReason})` : ""}`
        : `Hot lead rejected for ${requesterLabel} (#${userId})${rejectReason ? ` (reason: ${rejectReason})` : ""}`,
  });

  return { ...(lead.toJSON() as any), reviewedAssignee: assignees[idx] };
};

export const getMyHotLeadRequests = async ({
  userId,
  page = 1,
  limit = 10,
  campaignName,
  campaignId,
  leadId: leadIdFilter,
  /** Same semantics as manager list: pending / reviewed / all */
  reviewState = "all",
  filterType,
  startDate,
  endDate,
  search,
}: {
  userId: number;
  page?: number;
  limit?: number;
  campaignName?: string;
  campaignId?: number;
  leadId?: number;
  reviewState?: "pending" | "reviewed" | "all";
  filterType?: string;
  startDate?: string;
  endDate?: string;
  search?: string | null;
}) => {
  const effectiveCampaignName = await resolveEffectiveCampaignNameFromQuery(
    campaignName,
    campaignId,
  );
  const normalizedCampaign = effectiveCampaignName
    ? normalizeCampaignNameForApi(effectiveCampaignName)
    : "";

  const myLeadWhereParts: any[] = [
    literal(`JSON_CONTAINS(assignees, JSON_OBJECT('userId', ${Number(userId)}))`),
  ];
  if (normalizedCampaign) {
    myLeadWhereParts.push(
      Sequelize.where(
        Sequelize.fn("LOWER", Sequelize.fn("TRIM", Sequelize.col("campaignName"))),
        normalizedCampaign,
      ),
    );
  }
  if (leadIdFilter != null && !Number.isNaN(Number(leadIdFilter))) {
    myLeadWhereParts.push({ id: Number(leadIdFilter) });
  }

  const leads = await Lead.findAll({
    where:
      myLeadWhereParts.length === 1
        ? myLeadWhereParts[0]
        : { [Op.and]: myLeadWhereParts },
    order: [["updatedAt", "DESC"]],
  });

  const rows: any[] = [];
  let approvedCounter = 0;
  for (const lead of leads) {
    const assignees = extractAssignees(lead);
    const mine = assignees.find((a) => Number(a.userId) === Number(userId));
    if (!mine) continue;
    const hasHotContext =
      mine.hotLeadRequestStatus === "approved" ||
      mine.hotLeadRequestStatus === "rejected" ||
      (mine.hotLeadRequestStatus === "pending" && mine.status === "hot_lead");
    if (!hasHotContext) continue;
    if (reviewState === "pending") {
      if (!(mine.hotLeadRequestStatus === "pending" && mine.status === "hot_lead")) continue;
    } else if (reviewState === "reviewed") {
      if (
        !(
          mine.hotLeadRequestStatus === "approved" ||
          mine.hotLeadRequestStatus === "rejected"
        )
      ) {
        continue;
      }
    }
    if (mine.hotLeadRequestStatus === "approved") approvedCounter++;
    rows.push({
      leadId: (lead as any).id,
      leadCode: lead.leadCode,
      campaignName: (lead as any).campaignName,
      leadData: (lead as any).leadData,
      status: mine.status,
      hotLeadRequestStatus: mine.hotLeadRequestStatus || null,
      hotLeadPreviousStatus: mine.hotLeadPreviousStatus || null,
      hotLeadRequestedAt: mine.hotLeadRequestedAt || null,
      hotLeadRequestComment: mine.hotLeadRequestComment || null,
      hotLeadReviewReason: mine.hotLeadReviewReason || null,
      hotLeadReviewedAt: mine.hotLeadReviewedAt || null,
      hotLeadReviewedBy: mine.hotLeadReviewedBy || null,
      hotLeadRejectReason: mine.hotLeadRejectReason || null,
    });
  }

  const dateRange = resolveHotLeadDateRange(filterType, startDate, endDate);
  const dateFilteredRows = dateRange
    ? rows.filter((row) => inHotLeadDateRange(row, dateRange))
    : rows;

  const searchFiltered = filterHotLeadRowsBySearch(dateFilteredRows, search);

  const totalItems = searchFiltered.length;
  const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / limit);
  const start = (page - 1) * limit;
  const statusCounts = searchFiltered.reduce(
    (acc, item) => {
      const status = String(item?.hotLeadRequestStatus || "").toLowerCase().trim();
      if (status === "approved") acc.approved += 1;
      else if (status === "rejected") acc.rejected += 1;
      else acc.pending += 1;
      return acc;
    },
    { pending: 0, approved: 0, rejected: 0 },
  );
  return {
    rows: searchFiltered.slice(start, start + limit),
    totalItems,
    totalPages,
    currentPage: page,
    pageSize: limit,
    approvedHotLeadCount: approvedCounter,
    statusCounts,
  };
};

export const getLeadsByCampaignAndAssignee = async (
  campaignName: string,
  assigneeId: number,
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
              literal(`JSON_OBJECT('userId', ${assigneeId})`),
            ),
            true,
          ),
        ],
      },
    });

    return leads.map((lead) => ({ ...(lead.toJSON() as any) }));
  } catch (error: any) {
    throw new Error(
      `Error fetching leads for campaign '${campaignName}' and assignee '${assigneeId}': ${error.message}`,
    );
  }
};

export interface AssignmentHistoryItem {
  assignedAt: string;
  userId: number;
  userName: string;
  campaignName: string;
  leadCount: number;
}

export interface GetAssignmentHistoryParams {
  page?: number;
  limit?: number;
  userId?: number;
  campaignName?: string;
  filterType?: FilterType;
  startDate?: string;
  endDate?: string;
}

export const getAssignmentHistory = async ({
  page = 1,
  limit = 10,
  userId,
  campaignName,
  filterType,
  startDate,
  endDate,
}: GetAssignmentHistoryParams): Promise<{
  data: AssignmentHistoryItem[];
  totalItems: number;
  currentPage: number;
  totalPages: number;
  pageSize: number;
}> => {
  try {
    // Build base where condition for leads with assignments
    const whereCondition: any = {
      [Op.and]: [Sequelize.literal("JSON_LENGTH(assignees) > 0")],
    };

    // Campaign filter
    if (campaignName && campaignName.trim() !== "") {
      whereCondition[Op.and].push(
        Sequelize.where(
          Sequelize.fn("LOWER", Sequelize.col("campaignName")),
          campaignName.trim().toLowerCase(),
        ),
      );
    }

    // Fetch all leads with assignments (no pagination yet, we'll paginate after grouping)
    const leads = await Lead.findAll({
      where: whereCondition,
      attributes: ["id", "campaignName", "assignees", "createdAt"],
      order: [["createdAt", "DESC"]],
    });

    // Extract all assignments from leads
    const allAssignments: Array<{
      assignedAt: Date;
      userId: number;
      campaignName: string;
      leadId: number;
    }> = [];

    for (const lead of leads) {
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

      for (const assignee of assigneesRaw) {
        if (assignee.userId) {
          const assignedDate = assignee.assignedAt
            ? new Date(assignee.assignedAt)
            : lead.createdAt;

          allAssignments.push({
            assignedAt: assignedDate,
            userId: assignee.userId,
            campaignName: lead.campaignName,
            leadId: lead.id,
          });
        }
      }
    }

    // Apply date filter to assignments
    let filteredAssignments = allAssignments;
    if (filterType) {
      const dateFilter = buildDateFilter(filterType, startDate, endDate);
      if (dateFilter.createdAt) {
        const filterCondition = dateFilter.createdAt;
        if (
          filterCondition[Op.between] &&
          Array.isArray(filterCondition[Op.between])
        ) {
          const betweenValue = filterCondition[Op.between] as Date[];
          if (betweenValue.length === 2) {
            const [start, end] = betweenValue;
            filteredAssignments = allAssignments.filter(
              (a) => a.assignedAt >= start && a.assignedAt <= end,
            );
          }
        } else if (filterCondition[Op.gte]) {
          const gteValue = filterCondition[Op.gte] as Date;
          filteredAssignments = allAssignments.filter(
            (a) => a.assignedAt >= gteValue,
          );
        } else if (filterCondition[Op.lte]) {
          const lteValue = filterCondition[Op.lte] as Date;
          filteredAssignments = allAssignments.filter(
            (a) => a.assignedAt <= lteValue,
          );
        }
      }
    }

    // Apply user filter
    if (userId) {
      filteredAssignments = filteredAssignments.filter(
        (a) => a.userId === userId,
      );
    }

    // Apply campaign filter to assignments (additional safety check)
    if (campaignName && campaignName.trim() !== "") {
      const campaignFilter = campaignName.trim().toLowerCase();
      filteredAssignments = filteredAssignments.filter(
        (a) =>
          a.campaignName &&
          a.campaignName.toLowerCase().includes(campaignFilter),
      );
    }

    // Group assignments by userId, campaignName, and assignedAt timestamp
    // Group assignments that happen within the same minute (for bulk assignments)
    const groupedMap = new Map<
      string,
      { count: number; assignedAt: Date; userId: number; campaignName: string }
    >();

    for (const assignment of filteredAssignments) {
      // Round assignedAt to the nearest minute to group bulk assignments together
      const assignedDate = new Date(assignment.assignedAt);
      assignedDate.setSeconds(0, 0); // Round to minute

      // Create a key using a separator that won't appear in campaign names
      // Use ||| as separator since it's unlikely to appear in campaign names
      const key = `${assignment.userId}|||${assignment.campaignName}|||${assignedDate.toISOString()}`;

      if (!groupedMap.has(key)) {
        groupedMap.set(key, {
          count: 0,
          assignedAt: assignedDate,
          userId: assignment.userId,
          campaignName: assignment.campaignName,
        });
      }
      groupedMap.get(key)!.count += 1;
    }

    // Fetch user names for all unique user IDs
    const uniqueUserIds = [
      ...new Set(filteredAssignments.map((a) => a.userId)),
    ];
    const users = await User.findAll({
      where: { id: uniqueUserIds },
      attributes: ["id", "firstname", "lastname"],
    });

    const userMap = new Map(
      users.map((u) => [
        u.id,
        `${u.firstname || ""} ${u.lastname || ""}`.trim() || "Unknown User",
      ]),
    );

    // Build history items from grouped map
    const historyItems: AssignmentHistoryItem[] = [];

    for (const [key, groupData] of groupedMap.entries()) {
      // Parse the key: userId|||campaignName|||timestamp
      // We already have userId and campaignName in groupData, so we can use them directly
      historyItems.push({
        assignedAt: groupData.assignedAt.toISOString(),
        userId: groupData.userId,
        userName: userMap.get(groupData.userId) || "Unknown User",
        campaignName: groupData.campaignName,
        leadCount: groupData.count,
      });
    }

    // Sort by assignedAt (newest first)
    historyItems.sort(
      (a, b) =>
        new Date(b.assignedAt).getTime() - new Date(a.assignedAt).getTime(),
    );

    // Apply pagination
    const totalItems = historyItems.length;
    const { offset } = getPagination({ page, limit });
    const paginatedItems = historyItems.slice(offset, offset + limit);

    return {
      data: paginatedItems,
      totalItems,
      currentPage: page,
      totalPages: Math.ceil(totalItems / limit),
      pageSize: limit,
    };
  } catch (error: any) {
    throw new Error(`Error fetching assignment history: ${error.message}`);
  }
};

interface GetAssignmentLeadsParams {
  userId: number;
  campaignName: string;
  assignedAt: string; // ISO timestamp
  page?: number;
  limit?: number;
  search?: string;
}

export const getAssignmentLeads = async ({
  userId,
  campaignName,
  assignedAt,
  page = 1,
  limit = 10,
  search,
}: GetAssignmentLeadsParams): Promise<{
  data: any[];
  totalItems: number;
  currentPage: number;
  totalPages: number;
  pageSize: number;
}> => {
  try {
    // Parse the assignedAt timestamp and round to the minute (same as grouping logic)
    const assignmentDate = new Date(assignedAt);
    assignmentDate.setSeconds(0, 0); // Round to minute

    // Calculate the range for the same minute (start and end of that minute)
    const minuteStart = new Date(assignmentDate);
    const minuteEnd = new Date(assignmentDate);
    minuteEnd.setSeconds(59, 999); // End of the same minute

    // Fetch all leads for the campaign
    const allLeads = await Lead.findAll({
      where: {
        campaignName: campaignName,
        [Op.and]: [Sequelize.literal("JSON_LENGTH(assignees) > 0")],
      },
      order: [["createdAt", "DESC"]],
    });

    // Filter leads that have an assignment matching userId and assignedAt within the same minute
    const matchingLeads: any[] = [];

    for (const lead of allLeads) {
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

      // Check if this lead has an assignment matching the criteria
      for (const assignee of assigneesRaw) {
        if (assignee.userId === userId) {
          const assigneeAssignedAt = assignee.assignedAt
            ? new Date(assignee.assignedAt)
            : lead.createdAt;

          // Round to minute for comparison
          const assigneeDate = new Date(assigneeAssignedAt);
          assigneeDate.setSeconds(0, 0);

          // Check if assignedAt matches (within the same minute)
          if (assigneeDate.getTime() === assignmentDate.getTime()) {
            // This lead matches! Enrich it with assignee data
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
                const assignment = assigneesRaw.find(
                  (a) => a.userId === user.id,
                );
                return {
                  ...user.toJSON(),
                  status: assignment?.status || "pending",
                };
              });
            }

            matchingLeads.push({
              ...lead.toJSON(),
              assignees: assigneesData,
            });

            // Break inner loop since we found a match for this lead
            break;
          }
        }
      }
    }

    // Apply search filter if provided
    let filteredLeads = matchingLeads;
    if (search && search.trim() !== "") {
      filteredLeads = matchingLeads.filter((lead) =>
        leadPartialRowMatchesSearch(lead, search),
      );
    }

    // Apply pagination
    const totalItems = filteredLeads.length;
    const { offset } = getPagination({ page, limit });
    const paginatedLeads = filteredLeads.slice(offset, offset + limit);

    return {
      data: paginatedLeads,
      totalItems,
      currentPage: page,
      totalPages: Math.ceil(totalItems / limit),
      pageSize: limit,
    };
  } catch (error: any) {
    throw new Error(`Error fetching assignment leads: ${error.message}`);
  }
};

/** First assignee userId from JSON assignees (for display). */
const getFirstAssigneeUserId = (assigneesRaw: unknown): number | null => {
  let arr: any[] = [];
  if (typeof assigneesRaw === "string") {
    try {
      arr = JSON.parse(assigneesRaw);
    } catch {
      arr = [];
    }
  } else if (Array.isArray(assigneesRaw)) {
    arr = assigneesRaw;
  }
  const uid = Number(arr?.[0]?.userId);
  return Number.isFinite(uid) && uid > 0 ? uid : null;
};

const enrichLeadsWithAssigneeUsername = async (leads: any[]): Promise<void> => {
  const ids = new Set<number>();
  for (const row of leads) {
    const uid = getFirstAssigneeUserId(row.assignees);
    if (uid) ids.add(uid);
  }
  if (ids.size === 0) {
    for (const row of leads) {
      row.username = "";
      row.assigneeDisplayName = "";
    }
    return;
  }
  const users = await User.findAll({
    where: { id: { [Op.in]: [...ids] } },
    attributes: ["id", "email", "firstname", "lastname"],
  });
  const byId = new Map(users.map((u) => [u.id, u.toJSON() as any]));
  for (const row of leads) {
    const uid = getFirstAssigneeUserId(row.assignees);
    const u = uid ? byId.get(uid) : null;
    row.username = u?.email ? String(u.email) : "";
    row.assigneeDisplayName = u
      ? `${String(u.firstname || "").trim()} ${String(u.lastname || "").trim()}`.trim()
      : "";
  }
};

/** Users available for "Leads with Work" filter dropdown (manager = brand users; admin = users with lead work). */
export const getLeadsWithWorkFilterUsers = async ({
  brandUserIds,
  isAdmin,
}: {
  brandUserIds?: number[];
  isAdmin: boolean;
}): Promise<{ users: { id: number; firstname?: string; lastname?: string; email?: string }[] }> => {
  if (!isAdmin && (!brandUserIds || brandUserIds.length === 0)) {
    return { users: [] };
  }
  if (!isAdmin && brandUserIds?.length) {
    const users = await User.findAll({
      where: { id: { [Op.in]: brandUserIds } },
      attributes: ["id", "firstname", "lastname", "email"],
      order: [
        ["firstname", "ASC"],
        ["lastname", "ASC"],
      ],
    });
    return { users: users.map((u) => u.toJSON() as any) };
  }
  const rows = (await db.query(
    `
    SELECT DISTINCT u.id, u.firstname, u.lastname, u.email
    FROM users u
    WHERE u.id IN (
      SELECT DISTINCT createdBy FROM notes WHERE notebleType = 'lead' AND createdBy IS NOT NULL
      UNION
      SELECT DISTINCT performedBy FROM lead_activities WHERE entityType = 'lead' AND performedBy IS NOT NULL
    )
    ORDER BY u.email ASC
    LIMIT 500
    `,
    { type: QueryTypes.SELECT },
  )) as any[];
  return { users: rows };
};

/**
 * Raw SQL `DATETIME` (e.g. `GREATEST(MAX(...))`) often reaches Node as a string without `Z`.
 * Sequelize / MySQL for this project stores instants in UTC; without an offset, browsers parse
 * `YYYY-MM-DD HH:mm:ss` as *local* wall time → ~5h skew vs lead detail (`updatedAt` with `Z`).
 */
const lastWorkDateSqlValueToUtcIso = (value: unknown): string | null => {
  if (value == null) return null;
  if (value instanceof Date) {
    const t = value.getTime();
    if (!Number.isFinite(t) || t <= 0) return null;
    return value.toISOString();
  }
  const s = String(value).trim();
  if (!s || s.startsWith("1970-01-01")) return null;
  const hasOffset = /Z$|[+-]\d{2}:?\d{2}$/.test(s);
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(s) && !hasOffset) {
    const d = new Date(`${s.replace(" ", "T")}Z`);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
};

/**
 * Get leads with work done (notes, comments, activities, reminders)
 * Admin: all leads with work. Manager: only leads where work done by their brand users.
 */
export const getLeadsWithWork = async ({
  page = 1,
  limit = 10,
  search = "",
  filterType,
  startDate,
  endDate,
  brandUserIds,
  filterUserId,
}: {
  page?: number;
  limit?: number;
  search?: string;
  filterType?: FilterType;
  startDate?: string;
  endDate?: string;
  brandUserIds?: number[];
  /** When set, only notes/activities by this user count as "work" for filtering. */
  filterUserId?: number;
}) => {
  try {
    if (brandUserIds !== undefined && brandUserIds.length === 0) {
      return {
        data: [],
        totalItems: 0,
        currentPage: page,
        totalPages: 0,
        pageSize: limit,
      };
    }

    const { offset } = getPagination({ page, limit });

    // Build date filter for work done date (when note/activity was created)
    const dateFilter =
      filterType && filterType.trim() !== ""
        ? buildDateFilter(filterType, startDate, endDate)
        : {};
    const createdAtFilter: any = (dateFilter as any)?.createdAt;

    // Translate date filter to SQL snippets for join conditions
    let notesDateSql = "";
    let actsDateSql = "";
    const replacements: any = { limit, offset };

    if (createdAtFilter?.[Op.between]) {
      notesDateSql = " AND n.createdAt BETWEEN :start AND :end ";
      actsDateSql = " AND la.createdAt BETWEEN :start AND :end ";
      replacements.start = createdAtFilter[Op.between][0];
      replacements.end = createdAtFilter[Op.between][1];
    } else if (createdAtFilter?.[Op.gte]) {
      notesDateSql = " AND n.createdAt >= :start ";
      actsDateSql = " AND la.createdAt >= :start ";
      replacements.start = createdAtFilter[Op.gte];
    } else if (createdAtFilter?.[Op.lte]) {
      notesDateSql = " AND n.createdAt <= :end ";
      actsDateSql = " AND la.createdAt <= :end ";
      replacements.end = createdAtFilter[Op.lte];
    }

    const qRaw = normalizeLeadCodeSearchInput(search || "");
    const q = qRaw.toLowerCase();
    let searchSql = "";
    if (q) {
      searchSql =
        " AND (LOWER(l.campaignName) LIKE :q OR LOWER(CAST(l.leadData AS CHAR)) LIKE :q OR CAST(l.id AS CHAR) LIKE :q ";
      replacements.q = `%${q}%`;
      const leadCodeMatch = qRaw.match(/^([A-Za-z]+)-?(\d+)$/);
      if (leadCodeMatch) {
        const codeNum = Number(leadCodeMatch[2]);
        if (Number.isFinite(codeNum) && codeNum > 0) {
          searchSql += "OR l.id = :leadCodeNumericId ";
          replacements.leadCodeNumericId = codeNum;
        }
      }
      searchSql += ") ";
    }

    let userScopeSql = "";
    if (filterUserId != null && filterUserId > 0) {
      userScopeSql = ` AND ((n.id IS NOT NULL AND n.createdBy = :filterUid) OR (la.id IS NOT NULL AND la.performedBy = :filterUid)) `;
      replacements.filterUid = filterUserId;
    } else if (brandUserIds && brandUserIds.length > 0) {
      userScopeSql = ` AND ((n.id IS NOT NULL AND n.createdBy IN (${brandUserIds.join(",")})) OR (la.id IS NOT NULL AND la.performedBy IN (${brandUserIds.join(",")}))) `;
    }

    // Count first (for pagination)
    const countRows = (await db.query(
      `
      SELECT COUNT(DISTINCT l.id) AS total
      FROM leads l
      LEFT JOIN notes n
        ON n.notebleId = l.id
        AND n.notebleType = 'lead'
        ${notesDateSql}
      LEFT JOIN lead_activities la
        ON la.entityId = l.id
        AND la.entityType = 'lead'
        ${actsDateSql}
      WHERE (n.id IS NOT NULL OR la.id IS NOT NULL)
      ${userScopeSql}
      ${searchSql}
      `,
      { type: QueryTypes.SELECT, replacements },
    )) as any[];

    const totalItems = Number((countRows?.[0] as any)?.total || 0);
    if (!totalItems) {
      return {
        data: [],
        totalItems: 0,
        currentPage: page,
        totalPages: 0,
        pageSize: limit,
      };
    }

    const rows = (await db.query(
      `
      SELECT
        l.*,
        COUNT(DISTINCT n.id) AS notesCount,
        COUNT(DISTINCT la.id) AS activitiesCount,
        (
          SELECT n2.content
          FROM notes n2
          WHERE n2.notebleId = l.id
            AND n2.notebleType = 'lead'
            ${createdAtFilter?.[Op.between] ? " AND n2.createdAt BETWEEN :start AND :end " : ""}
            ${createdAtFilter?.[Op.gte] ? " AND n2.createdAt >= :start " : ""}
            ${createdAtFilter?.[Op.lte] ? " AND n2.createdAt <= :end " : ""}
          ORDER BY n2.createdAt DESC
          LIMIT 1
        ) AS latestNote,
        GREATEST(
          IFNULL(MAX(n.createdAt), '1970-01-01'),
          IFNULL(MAX(la.createdAt), '1970-01-01')
        ) AS lastWorkDate
      FROM leads l
      LEFT JOIN notes n
        ON n.notebleId = l.id
        AND n.notebleType = 'lead'
        ${notesDateSql}
      LEFT JOIN lead_activities la
        ON la.entityId = l.id
        AND la.entityType = 'lead'
        ${actsDateSql}
      WHERE (n.id IS NOT NULL OR la.id IS NOT NULL)
      ${userScopeSql}
      ${searchSql}
      GROUP BY l.id
      ORDER BY lastWorkDate DESC, l.id DESC
      LIMIT :limit OFFSET :offset
      `,
      { type: QueryTypes.SELECT, replacements },
    )) as any[];

    const data = rows.map((row: any) => {
      const campaignName = row.campaignName || "";
      const leadCode = buildLeadCodeFromCampaignAndId(
        campaignName,
        Number(row.id),
      );

      const notesCount = Number(row.notesCount || 0);
      const activitiesCount = Number(row.activitiesCount || 0);

      return {
        ...row,
        leadCode,
        workSummary: {
          notesCount,
          activitiesCount,
          totalWorkCount: notesCount + activitiesCount,
          latestNote: row.latestNote || "",
          lastWorkDate: (() => {
            const raw = row.lastWorkDate;
            if (raw == null) return null;
            if (String(raw).trim().startsWith("1970-01-01")) return null;
            return lastWorkDateSqlValueToUtcIso(raw);
          })(),
        },
      };
    });

    await enrichLeadsWithAssigneeUsername(data);

    return {
      data,
      totalItems,
      currentPage: page,
      totalPages: Math.ceil(totalItems / limit),
      pageSize: limit,
    };
  } catch (error: any) {
    throw new Error(`Error fetching leads with work: ${error.message}`);
  }
};

/**
 * Get assignment leads that have work done (notes, activities)
 * Filters leads from a specific assignment and returns only those with work
 */
export const getAssignmentLeadsWithWork = async ({
  userId,
  campaignName,
  assignedAt,
  page = 1,
  limit = 10,
  search = "",
}: {
  userId: number;
  campaignName: string;
  assignedAt: string;
  page?: number;
  limit?: number;
  search?: string;
}): Promise<{
  data: any[];
  totalItems: number;
  currentPage: number;
  totalPages: number;
  pageSize: number;
}> => {
  try {
    // First, get all leads from this assignment (reuse existing logic)
    const assignmentDate = new Date(assignedAt);
    assignmentDate.setSeconds(0, 0); // Round to minute

    // Fetch all leads for the campaign
    const allLeads = await Lead.findAll({
      where: {
        campaignName: campaignName,
        [Op.and]: [Sequelize.literal("JSON_LENGTH(assignees) > 0")],
      },
      order: [["createdAt", "DESC"]],
    });

    // Filter leads that have an assignment matching userId and assignedAt within the same minute
    const matchingLeads: any[] = [];

    for (const lead of allLeads) {
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

      // Check if this lead has an assignment matching the criteria
      for (const assignee of assigneesRaw) {
        if (assignee.userId === userId) {
          const assigneeAssignedAt = assignee.assignedAt
            ? new Date(assignee.assignedAt)
            : lead.createdAt;

          // Round to minute for comparison
          const assigneeDate = new Date(assigneeAssignedAt);
          assigneeDate.setSeconds(0, 0);

          // Check if assignedAt matches (within the same minute)
          if (assigneeDate.getTime() === assignmentDate.getTime()) {
            // This lead matches the assignment! Now check if it has work
            const notesCount = await Note.count({
              where: { notebleId: lead.id, notebleType: "lead" },
            });

            const activitiesCount = await LeadActivity.count({
              where: { entityId: lead.id, entityType: "lead" },
            });

            // Only include leads that have work (notes OR activities)
            if (notesCount > 0 || activitiesCount > 0) {
              // Get work summary
              const notes = await Note.findAll({
                where: { notebleId: lead.id, notebleType: "lead" },
                order: [["createdAt", "DESC"]],
                limit: 1,
              });

              const activities = await LeadActivity.findAll({
                where: { entityId: lead.id, entityType: "lead" },
                order: [["createdAt", "DESC"]],
                limit: 1,
              });

              const lastNote = notes[0];
              const lastActivity = activities[0];

              let lastWorkDate: Date | null = null;
              let lastWorkedBy: string | null = null;

              if (lastActivity && lastNote) {
                const activityDate = new Date(lastActivity.createdAt);
                const noteDate = new Date(lastNote.createdAt);
                if (activityDate > noteDate) {
                  lastWorkDate = activityDate;
                  const activityUser = await User.findByPk(
                    lastActivity.performedBy,
                    {
                      attributes: ["firstname", "lastname"],
                    },
                  );
                  lastWorkedBy = activityUser
                    ? `${activityUser.firstname || ""} ${activityUser.lastname || ""}`.trim()
                    : null;
                } else {
                  lastWorkDate = noteDate;
                  const noteUser = await User.findByPk(lastNote.createdBy, {
                    attributes: ["firstname", "lastname"],
                  });
                  lastWorkedBy = noteUser
                    ? `${noteUser.firstname || ""} ${noteUser.lastname || ""}`.trim()
                    : null;
                }
              } else if (lastActivity) {
                lastWorkDate = new Date(lastActivity.createdAt);
                const activityUser = await User.findByPk(
                  lastActivity.performedBy,
                  {
                    attributes: ["firstname", "lastname"],
                  },
                );
                lastWorkedBy = activityUser
                  ? `${activityUser.firstname || ""} ${activityUser.lastname || ""}`.trim()
                  : null;
              } else if (lastNote) {
                lastWorkDate = new Date(lastNote.createdAt);
                const noteUser = await User.findByPk(lastNote.createdBy, {
                  attributes: ["firstname", "lastname"],
                });
                lastWorkedBy = noteUser
                  ? `${noteUser.firstname || ""} ${noteUser.lastname || ""}`.trim()
                  : null;
              }

              // Enrich with assignee data
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
                  const assignment = assigneesRaw.find(
                    (a) => a.userId === user.id,
                  );
                  return {
                    ...user.toJSON(),
                    status: assignment?.status || "pending",
                  };
                });
              }

              matchingLeads.push({
                ...lead.toJSON(),
                assignees: assigneesData,
                notesCount,
                activitiesCount,
                totalWorkCount: notesCount + activitiesCount,
                latestNote: lastNote?.content || "",
                lastWorkDate: lastWorkDate ? lastWorkDate.toISOString() : null,
                lastWorkedBy,
              });
            }

            // Break inner loop since we found a match for this lead
            break;
          }
        }
      }
    }

    // Apply search filter if provided
    let filteredLeads = matchingLeads;
    if (search && search.trim() !== "") {
      filteredLeads = matchingLeads.filter((lead) =>
        leadPartialRowMatchesSearch(lead, search),
      );
    }

    // Apply pagination
    const totalItems = filteredLeads.length;
    const { offset } = getPagination({ page, limit });
    const paginatedLeads = filteredLeads.slice(offset, offset + limit);

    return {
      data: paginatedLeads,
      totalItems,
      currentPage: page,
      totalPages: Math.ceil(totalItems / limit),
      pageSize: limit,
    };
  } catch (error: any) {
    throw new Error(
      `Error fetching assignment leads with work: ${error.message}`,
    );
  }
};

/**
 * Get all campaigns for a user with leads with work counts
 * Returns summary for each campaign the user has assignments in
 */
export const getUserCampaignsWithWorkSummary = async ({
  userId,
}: {
  userId: number;
}): Promise<{
  campaigns: Array<{
    campaignName: string;
    totalLeads: number;
    leadsWithWork: number;
  }>;
}> => {
  try {
    console.log(
      `🔍 getUserCampaignsWithWorkSummary called for userId: ${userId}`,
    );

    // Get user with role and permissions
    const user = await User.findByPk(userId);

    if (!user) {
      console.log(`⚠️ User ${userId} not found`);
      return { campaigns: [] };
    }

    console.log(
      `👤 User found: ${user.firstname} ${user.lastname}, roleId: ${(user as any).roleId}`,
    );

    // Get role separately if roleId exists
    let userRole: any = null;
    if ((user as any).roleId) {
      userRole = await Role.findByPk((user as any).roleId, {
        include: [{ model: Permission }],
      });
    }

    if (!userRole) {
      console.log(`⚠️ User ${userId} has no role or role not found`);
      return { campaigns: [] };
    }

    console.log(
      `👤 User role: ${userRole.name}, Permissions count: ${(userRole as any).Permissions?.length || 0}`,
    );

    const isAdmin = userRole.name?.toLowerCase() === "admin";
    console.log(`👤 isAdmin: ${isAdmin}`);

    let accessibleCampaignIds: number[] = [];
    let accessibleCampaignNames: string[] = [];

    if (isAdmin) {
      // Admin has access to all campaigns - get all campaigns
      const allCampaigns = await Campaign.findAll({
        attributes: ["id", "campaignName"],
      });
      accessibleCampaignIds = allCampaigns.map((c) => c.id);
      accessibleCampaignNames = allCampaigns.map((c) => c.campaignName);
      console.log(`👑 Admin - found ${accessibleCampaignIds.length} campaigns`);
    } else {
      // Get campaigns from permissions
      const permissions = (userRole as any).Permissions || [];
      console.log(`📋 User has ${permissions.length} total permissions`);

      const campaignPermissions = permissions.filter(
        (perm: any) =>
          perm.name === "getCampaignById" &&
          (perm.resourceId || perm.resourceType),
      );

      console.log(
        `🎯 Found ${campaignPermissions.length} campaign permissions:`,
        campaignPermissions.map((p: any) => ({
          name: p.name,
          resourceId: p.resourceId,
          resourceType: p.resourceType,
        })),
      );

      // Extract campaign IDs and names from permissions
      for (const perm of campaignPermissions) {
        if (perm.resourceId) {
          const campaignId = parseInt(perm.resourceId);
          if (
            !isNaN(campaignId) &&
            !accessibleCampaignIds.includes(campaignId)
          ) {
            accessibleCampaignIds.push(campaignId);
            console.log(`  ✅ Added campaign ID: ${campaignId}`);
          }
        }
        if (perm.resourceType && perm.resourceType.startsWith("campaign-")) {
          let campaignName = perm.resourceType.replace("campaign-", "").trim();
          // Try to find the actual campaign name from database to ensure exact match
          if (campaignName) {
            // First try to find by exact name match
            const campaignByName = await Campaign.findOne({
              where: Sequelize.where(
                Sequelize.fn("LOWER", Sequelize.col("campaignName")),
                Sequelize.fn("LOWER", campaignName),
              ),
              attributes: ["id", "campaignName"],
            });

            if (campaignByName) {
              const actualCampaignName = campaignByName.campaignName;
              if (!accessibleCampaignNames.includes(actualCampaignName)) {
                accessibleCampaignNames.push(actualCampaignName);
                console.log(
                  `  ✅ Added campaign name from resourceType (matched in DB): ${actualCampaignName} (from: ${campaignName})`,
                );
              }
            } else {
              // If not found, use the extracted name as-is
              if (!accessibleCampaignNames.includes(campaignName)) {
                accessibleCampaignNames.push(campaignName);
                console.log(
                  `  ✅ Added campaign name from resourceType (not found in DB): ${campaignName}`,
                );
              }
            }
          }
        }
      }

      // Fetch campaigns by IDs to get their names
      if (accessibleCampaignIds.length > 0) {
        const campaignsById = await Campaign.findAll({
          where: { id: { [Op.in]: accessibleCampaignIds } },
          attributes: ["id", "campaignName"],
        });
        console.log(`📦 Fetched ${campaignsById.length} campaigns by ID`);
        campaignsById.forEach((c) => {
          if (!accessibleCampaignNames.includes(c.campaignName)) {
            accessibleCampaignNames.push(c.campaignName);
            console.log(`  ✅ Added campaign name from DB: ${c.campaignName}`);
          }
        });
      }
    }

    console.log(
      `📦 Accessible campaigns: ${accessibleCampaignNames.length}`,
      accessibleCampaignNames,
    );

    if (accessibleCampaignNames.length === 0) {
      return { campaigns: [] };
    }

    // For each accessible campaign, count leads assigned to user and leads with work
    const campaignsSummary = await Promise.all(
      accessibleCampaignNames.map(async (campaignName) => {
        // Get all leads for this campaign that have this user as assignee
        // Use case-insensitive matching for campaign name
        const allLeads = await Lead.findAll({
          where: {
            [Op.and]: [
              Sequelize.where(
                Sequelize.fn("LOWER", Sequelize.col("campaignName")),
                Sequelize.fn("LOWER", campaignName),
              ),
              Sequelize.literal("JSON_LENGTH(assignees) > 0"),
            ],
          },
        });

        let totalLeads = 0;
        const leadIds: number[] = [];

        for (const lead of allLeads) {
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

          // Check if this lead has this user as an assignee
          const hasUser = assigneesRaw.some(
            (assignee) => assignee.userId === userId,
          );

          if (hasUser) {
            totalLeads++;
            leadIds.push(lead.id);
          }
        }

        // Count leads with work
        let leadsWithWorkCount = 0;

        for (const leadId of leadIds) {
          const notesCount = await Note.count({
            where: { notebleId: leadId, notebleType: "lead" },
          });

          const activitiesCount = await LeadActivity.count({
            where: { entityId: leadId, entityType: "lead" },
          });

          if (notesCount > 0 || activitiesCount > 0) {
            leadsWithWorkCount++;
          }
        }

        console.log(
          `✅ Campaign: ${campaignName}, Total: ${totalLeads}, With Work: ${leadsWithWorkCount}`,
        );

        return {
          campaignName,
          totalLeads,
          leadsWithWork: leadsWithWorkCount,
        };
      }),
    );

    console.log(`🎯 Returning ${campaignsSummary.length} campaigns`);
    console.log(
      `📋 Final campaigns summary:`,
      campaignsSummary.map((c) => ({
        campaignName: c.campaignName,
        totalLeads: c.totalLeads,
        leadsWithWork: c.leadsWithWork,
      })),
    );

    return {
      campaigns: campaignsSummary,
    };
  } catch (error: any) {
    console.error(`❌ Error in getUserCampaignsWithWorkSummary:`, error);
    throw new Error(
      `Error fetching user campaigns with work summary: ${error.message}`,
    );
  }
};

/**
 * Get lead creation statistics grouped by user and date
 * @param userId - Optional user ID to filter by
 * @param startDate - Optional start date filter (YYYY-MM-DD)
 * @param endDate - Optional end date filter (YYYY-MM-DD)
 * @param campaignName - Optional campaign name filter
 */
export const getLeadCreationStats = async (
  userId?: number,
  startDate?: string,
  endDate?: string,
  campaignName?: string,
): Promise<{
  success: boolean;
  data: Array<{
    userId: number;
    userName: string;
    createdAt: string;
    campaignName: string;
    leadCount: number;
  }>;
  totalLeads: number;
}> => {
  try {
    // Build WHERE conditions
    let whereConditions = "l.createdBy IS NOT NULL";
    const replacements: any = {};

    if (userId) {
      whereConditions += " AND l.createdBy = :userId";
      replacements.userId = userId;
    }

    if (startDate && endDate && startDate === endDate) {
      // Same date selected - use exact date match with proper date casting
      // Use CAST to ensure proper date comparison
      whereConditions += " AND DATE(l.createdAt) = CAST(:startDate AS DATE)";
      replacements.startDate = startDate;
    } else {
      // Different dates or only one date - use range
      if (startDate) {
        whereConditions += " AND DATE(l.createdAt) >= CAST(:startDate AS DATE)";
        replacements.startDate = startDate;
      }
      if (endDate) {
        whereConditions += " AND DATE(l.createdAt) <= CAST(:endDate AS DATE)";
        replacements.endDate = endDate;
      }
    }

    if (campaignName) {
      whereConditions += " AND l.campaignName = :campaignName";
      replacements.campaignName = campaignName;
    }

    // Use raw SQL query for better performance with grouping
    const query = `
      SELECT 
        l.createdBy as userId,
        CONCAT(COALESCE(u.firstname, ''), ' ', COALESCE(u.lastname, '')) as userName,
        DATE(l.createdAt) as createdAt,
        l.campaignName as campaignName,
        COUNT(l.id) as leadCount
      FROM leads l
      LEFT JOIN users u ON l.createdBy = u.id
      WHERE ${whereConditions}
      GROUP BY l.createdBy, DATE(l.createdAt), l.campaignName
      ORDER BY createdAt DESC, userName ASC
    `;

    const results = (await db.query(query, {
      replacements,
      type: QueryTypes.SELECT,
    })) as Array<{
      userId: number;
      userName: string;
      createdAt: string;
      campaignName: string;
      leadCount: string | number;
    }>;

    // Process results
    const stats = results.map((row) => {
      const userName = (row.userName || "").trim() || `User ID ${row.userId}`;
      return {
        userId: row.userId,
        userName,
        createdAt: row.createdAt,
        campaignName: row.campaignName || "N/A",
        leadCount:
          typeof row.leadCount === "string"
            ? parseInt(row.leadCount)
            : row.leadCount,
      };
    });

    const totalLeads = stats.reduce((sum, stat) => sum + stat.leadCount, 0);

    return {
      success: true,
      data: stats,
      totalLeads,
    };
  } catch (error: any) {
    console.error("Error fetching lead creation statistics:", error);
    throw new Error(
      `Error fetching lead creation statistics: ${error.message}`,
    );
  }
};
