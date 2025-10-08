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



interface GetAllLeadsParams {
  page?: number;
  limit?: number;
  search?: string;
}

export const getAllLeadsWithAssignee = async ({
  page = 1,
  limit = 10,
  search = "",
}: GetAllLeadsParams) => {
  try {
    const { offset, limit: paginationLimit } = getPagination({ page, limit });

    // Base condition: leads with at least one assignee
    const whereCondition: any = Sequelize.literal("JSON_LENGTH(assignees) > 0");

    // Add search filter if provided
    let searchCondition: any = {};
    if (search.trim()) {
      searchCondition = {
        [Op.or]: [
          { name: { [Op.like]: `%${search}%` } },
          { email: { [Op.like]: `%${search}%` } },
          { phone: { [Op.like]: `%${search}%` } },
          { source: { [Op.like]: `%${search}%` } },
          { city: { [Op.like]: `%${search}%` } },
        ],
      };
    }

    // Combine both conditions (use AND if search applied)
    const combinedWhere = search.trim()
      ? { [Op.and]: [whereCondition, searchCondition] }
      : whereCondition;

    // Fetch leads with pagination
    const leads = await Lead.findAndCountAll({
      where: combinedWhere,
      order: [["createdAt", "DESC"]],
      offset,
      limit: paginationLimit,
    });

    // Enrich each lead with assignee details
    const enrichedLeads = await Promise.all(
      leads.rows.map(async (lead: any) => {
        let assigneesRaw: any[] = [];

        // Safe parse of assignees field
        if (lead.assignees) {
          if (typeof lead.assignees === "string") {
            try {
              const temp = JSON.parse(lead.assignees);
              assigneesRaw = Array.isArray(temp) ? temp : [temp];
            } catch (err) {
              console.warn(
                `⚠️ Failed to parse assignees string for lead ${lead.id}:`,
                err
              );
              assigneesRaw = [];
            }
          } else if (Array.isArray(lead.assignees)) {
            assigneesRaw = lead.assignees;
          } else if (typeof lead.assignees === "object") {
            assigneesRaw = [lead.assignees];
          }
        }

        // Extract user IDs
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

        return {
          ...lead.toJSON(),
          assignees: assigneesData,
        };
      })
    );

    // Paginate and return
    const response = getPagingData(
      { count: leads.count, rows: enrichedLeads },
      page,
      limit
    );

    return response;
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

export const getUnassignedLeads = async ({
  page = 1,
  limit = 10,
  searchTerm = "",
}: GetUnassignedLeadsParams) => {
  try {
    const { offset, limit: paginationLimit } = getPagination({ page, limit });

    // Build search filter (optional)
    const searchCondition = searchTerm
      ? {
          [Op.or]: [
            { name: { [Op.like]: `%${searchTerm}%` } },
            { email: { [Op.like]: `%${searchTerm}%` } },
            { phone: { [Op.like]: `%${searchTerm}%` } },
            { company: { [Op.like]: `%${searchTerm}%` } },
          ],
        }
      : {};

    // Combine unassigned leads condition with search
    const whereCondition = {
      [Op.and]: [
        Sequelize.literal("assignees IS NULL OR JSON_LENGTH(assignees) = 0"),
        searchCondition,
      ],
    };

    // Fetch paginated + filtered leads
    const unassignedLeads = await Lead.findAndCountAll({
      where: whereCondition,
      include: [
        {
          model: User,
          attributes: ["id", "firstname", "lastname", "email"],
        },
      ],
      order: [["createdAt", "DESC"]],
      offset,
      limit: paginationLimit,
    });

    // Normalize assignees for each lead
    const normalizedLeads = unassignedLeads.rows.map((lead: any) => {
      let assigneesRaw: any[] = [];

      if (lead.assignees) {
        if (typeof lead.assignees === "string") {
          try {
            const temp = JSON.parse(lead.assignees);
            assigneesRaw = Array.isArray(temp) ? temp : [temp];
          } catch (err) {
            console.warn(
              `⚠️ Failed to parse assignees for lead ${lead.id}, fallback to empty array`,
              err
            );
            assigneesRaw = [];
          }
        } else if (Array.isArray(lead.assignees)) {
          assigneesRaw = lead.assignees;
        } else if (typeof lead.assignees === "object") {
          assigneesRaw = [lead.assignees];
        }
      }

      return {
        ...lead.toJSON(),
        assignees: assigneesRaw,
      };
    });

    // Prepare paginated response
    const response = getPagingData(
      { count: unassignedLeads.count, rows: normalizedLeads },
      page,
      limit
    );

    return response;
  } catch (error: any) {
    throw new Error(`Error fetching unassigned leads: ${error.message}`);
  }
};

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

    // ✅ Use JSON_CONTAINS to query assignees JSON array
    const leads = await Lead.findAndCountAll({
      where: {
        ...dateFilter,
        [Op.and]: Sequelize.literal(
          `JSON_CONTAINS(assignees, '{"userId": ${assigneeId}}', '$')`
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

    // ✅ Map leads and extract status for current assignee
    const mappedLeads = leads.rows.map((lead) => {
      let assignees: AssigneeWithStatus[] = [];

      try {
        if (Array.isArray(lead.assignees)) {
          assignees = lead.assignees;
        } else if (typeof lead.assignees === "string") {
          // In case column is TEXT locally
          assignees = JSON.parse(lead.assignees);
        } else if (lead.assignees && typeof lead.assignees === "object") {
          assignees = lead.assignees as AssigneeWithStatus[];
        }
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

export const sendEmailToLeadUsingTemplate = async (
  leadId: number,
  templateKey: string,
  senderUserId: number
) => {
  console.log("🔍 Fetching lead with ID:", leadId, "Type:", typeof leadId);

  try {
    // First, check if the lead exists with detailed logging
    const lead = await Lead.findByPk(leadId);
    console.log("✅ Lead query result:", lead);

    if (!lead) {
      console.log("❌ Lead not found in database");

      // Debug: Check all leads to see what's actually in the database
      const allLeads = await Lead.findAll();
      console.log(
        "📋 All leads in database:",
        allLeads.map((l) => ({ id: l.id, campaignName: l.campaignName }))
      );

      throw new Error("Lead not found");
    }

    console.log("📋 Lead found:", lead.toJSON());

    let leadData;
    if (typeof lead.leadData === "string") {
      try {
        leadData = JSON.parse(lead.leadData);
        console.log("📝 Parsed leadData:", leadData);
      } catch (error: any) {
        console.error("❌ Error parsing leadData:", error);
        throw new Error("Invalid leadData format");
      }
    } else {
      leadData = lead.leadData;
      console.log("📝 leadData (already object):", leadData);
    }

    const email = leadData?.email;
    console.log("📧 Extracted email:", email);

    if (!email) {
      console.log("❌ No email found in leadData");
      throw new Error("Lead email not found in leadData");
    }

    // Rest of your code...
    const sender = await User.findByPk(senderUserId);
    const senderRole = String(sender?.role || "guest");
    console.log("👤 Sender:", sender?.id, "Role:", senderRole);

    const template = await EmailTemplate.findOne({
      where: { serviceName: templateKey },
    });
    console.log("📧 Template found:", template ? template.serviceName : "None");

    if (!template) throw new Error("Email template not found");

    const filledSubject = fillTemplate(template.subjectTemplate, leadData);
    const filledBody = fillTemplate(template.bodyTemplate, leadData);
    console.log("📨 Email subject:", filledSubject);

    const smtpRaw = await getSmtpConfig(senderUserId);
    const smtp = {
      host: smtpRaw.host || "",
      port: smtpRaw.port || 587,
      user: smtpRaw.user || "",
      pass: smtpRaw.pass || "",
    };
    console.log("🔧 SMTP config:", {
      ...smtp,
      pass: smtp.pass ? "***" : "empty",
    });

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

    console.log("✅ Email sent successfully to:", email);
    return { message: "Email sent successfully", to: email };
  } catch (error) {
    console.error("💥 Error in sendEmailToLeadUsingTemplate:", error);
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
      leadsByStatus[status] = leads;
    }

    return { statusCounts, leadsByStatus };
  } catch (error: any) {
    console.error("Error in getLeadStatusSummary:", error);
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
  console.log("🔹 Updating lead status request:", {
    leadId,
    userId,
    newStatus,
  });

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
    console.warn(
      `⚠️ Failed to parse assignees for lead ${lead.id}, resetting to empty array`,
      err
    );
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
