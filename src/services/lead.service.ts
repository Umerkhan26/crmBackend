import { literal, Op, Sequelize, where, fn, col, } from "sequelize";
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
): Promise<LeadAttributes> => {
  try {
    const lead = await Lead.create(data);

    if (userId) {
      await logActivity(userId, "create", `Lead created with ID ${lead.id}`);
      await sendNotification(userId, `New lead created with ID ${lead.id}`);
    }

    return lead.get();
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
    console.error("Error in getAllLeads:", error.stack);
    throw new Error(`Error fetching leads: ${error.message}`);
  }
};

export const getLeadsByCampaign = async (
  campaignName: string
): Promise<any[]> => {
  try {
    const leads = await Lead.findAll({ where: { campaignName } });

    // 🔗 Enrich assignees with user details (same as in getAllLeads)
    const rowsWithAssignees = await Promise.all(
      leads.map(async (lead) => {
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

        return { ...lead.toJSON(), assignees: assigneesData };
      })
    );

    return rowsWithAssignees;
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

    return lead.get();
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

    // Prepare new assignees (only those not already assigned)
    const newAssignees: AssigneeWithStatus[] = userIdsToAssign
      .filter((id: number) => !existingIds.has(id))
      .map((id: number) => ({ userId: id, status: "pending" }));

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

    return lead.get();
  } catch (error: any) {
    throw new Error(`Error assigning lead: ${error.message}`);
  }
};
/**
 * Get all leads that have at least one assignee
 */
export const getAllLeadsWithAssignee = async () => {
  try {
    const leads = await Lead.findAll({
      where: Sequelize.literal("JSON_LENGTH(assignees) > 0"),
    });

    const allUserIds = leads
      .flatMap((lead: any) => lead.assignees) // extract all IDs from JSON array
      .filter((id: any) => !!id);

    const uniqueUserIds = [...new Set(allUserIds)];

    const users = await User.findAll({
      where: { id: uniqueUserIds },
      attributes: ["id", "name", "email", "role"],
    });

    const leadsWithAssigneeDetails = leads.map((lead: any) => ({
      ...lead.toJSON(),
      assigneeDetails: users.filter((u) => lead.assignees.includes(u.id)),
    }));

    return leadsWithAssigneeDetails;
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

/**
 * Get all unassigned leads
 */
export const getUnassignedLeads = async () => {
  try {
    const unassignedLeads = await Lead.findAll({
      where: Sequelize.literal("JSON_LENGTH(assignees) = 0"), // ✅ No assignments
      include: [
        {
          model: User,
          attributes: ["id", "name", "email"],
        },

      ],
    });

    return unassignedLeads;
  } catch (error: any) {
    throw new Error(`Error fetching unassigned leads: ${error.message}`);
  }
};

/**
 * Get all leads assigned to a specific user
 */

export const getLeadsByAssigneeId = async (
  assigneeId: number,
  filterType: FilterType = "daily",
  startDate?: string,
  endDate?: string,
  page: number = 1,
  limit: number = 10
) => {
  try {
    const dateFilter = buildDateFilter(filterType, startDate, endDate);
    const { offset } = getPagination({ page, limit });
    const leads = await Lead.findAndCountAll({
      where: {
        ...dateFilter,
        [Op.and]: Sequelize.literal(
          `JSON_SEARCH(JSON_EXTRACT(assignees, '$[*].userId'), 'one', '${assigneeId}') IS NOT NULL`
        ),
      },
      attributes: [
        "id",
        "campaignName",
        "leadData",
        "assignees",
        "createdAt",
        "updatedAt",
      ],
      offset,
      limit,
    });
    // Map leads to include user-specific status
    const mappedLeads = leads.rows.map((lead) => {
      let assignees: AssigneeWithStatus[] = [];
      try {
        assignees = Array.isArray(lead.assignees)
          ? lead.assignees
          : typeof lead.assignees === "string"
            ? JSON.parse(lead.assignees)
            : [];
      } catch (error) {
        console.warn(`Failed to parse assignees for lead ${lead.id}:`, error);
        assignees = [];
      }
      const userAssignment = assignees.find(
        (a) => Number(a.userId) === assigneeId
      );
      return {
        ...lead.get(),
        status: userAssignment?.status || "pending",
      };
    });
    return {
      count: leads.count,
      rows: mappedLeads,
    };
  } catch (error: any) {
    throw new Error(
      `Error fetching leads for assignee ID ${assigneeId}: ${error.message}`
    );
  }
};
// ✅ Corrected function
export const sendEmailToLeadUsingTemplate = async (
  leadId: number,
  templateKey: string,
  senderUserId: number
) => {
  console.log("Fetching lead with ID:", leadId);
  const lead = await Lead.findByPk(leadId);
  if (!lead) {
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

  // ✅ Log the activity here
  await logLeadActivity({
    entityId: leadId,
    entityType: "lead",
    action: "email_sent",
    performedBy: senderUserId,
    details: `Email sent using template "${templateKey}" to ${email}`,
  });

  return { message: "Email sent successfully", to: email };
};
// ✅ Helper: replace {{key}} in text with values from leadData
function fillTemplate(template: string, data: any): string {
  return template.replace(/{{(.*?)}}/g, (_, key) => {
    const trimmedKey = key.trim();
    return data?.[trimmedKey] || "";
  });
}


/**
 * Get lead status counts + leads grouped by status
 * @param assigneeId optional filter by specific user
 */
export const getLeadStatusSummary = async (assigneeId?: number) => {
  try {
    const statuses = ["pending", "sold", "most_interested", "to_call"]; // Default statuses
    const statusCounts: Record<string, number> = {};
    const leadsByStatus: Record<string, any[]> = {};

    // Loop over each status and fetch only those leads
    for (const status of statuses) {
      // Build WHERE clause for filtering JSON array of assignees
      let whereCondition;
      if (assigneeId) {
        whereCondition = Sequelize.literal(
          `JSON_SEARCH(JSON_EXTRACT(assignees, '$[*].status'), 'one', '${status}') IS NOT NULL
           AND JSON_SEARCH(JSON_EXTRACT(assignees, '$[*].userId'), 'one', '${assigneeId}') IS NOT NULL`
        );
      } else {
        whereCondition = Sequelize.literal(
          `JSON_SEARCH(JSON_EXTRACT(assignees, '$[*].status'), 'one', '${status}') IS NOT NULL`
        );
      }

      const leads = await Lead.findAll({
        where: whereCondition,
        order: [["createdAt", "DESC"]],
      });

      statusCounts[status] = leads.length;
      leadsByStatus[status] = leads;
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
  console.log("🔹 Updating lead status request:", { leadId, userId, newStatus });

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

  if (Array.isArray(lead.assignees)) {
    assignees = lead.assignees;
  } else if (typeof lead.assignees === "string") {
    try {
      assignees = JSON.parse(lead.assignees);
    } catch {
      console.warn("⚠️ Failed to parse assignees JSON, resetting to empty array");
      assignees = [];
    }
  }

  const index = assignees.findIndex((a) => a.userId === userId);
  if (index === -1) {
    throw new Error(`User ID ${userId} is not assigned to lead ID ${leadId}`);
  }

  const previousStatus = assignees[index].status;
  assignees[index].status = newStatus;

  await lead.update({ assignees });

  // ✅ Log the activity with error handling
  try {
    const logResult = await logLeadActivity({
      entityId: leadId,
      entityType: "lead",
      action: "status_updated",
      performedBy: userId,
      details: `Status changed from "${previousStatus}" to "${newStatus}"`,
    });

    console.log("✅ Lead status updated and activity logged:", logResult);
  } catch (err) {
    console.error("❌ Failed to log lead activity:", err);
  }

  return lead;
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

    return leads.map((lead) => lead.get());
  } catch (error: any) {
    throw new Error(
      `Error fetching leads for campaign '${campaignName}' and assignee '${assigneeId}': ${error.message}`
    );
  }
};