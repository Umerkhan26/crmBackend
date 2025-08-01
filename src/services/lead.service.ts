import { Op, Sequelize } from "sequelize";
import Lead, {
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
}: any) => {
  try {
    const { offset, limit: pageLimit } = getPagination({ page, limit });

    const whereCondition: any = { ...filters };

    // Search condition on leadData JSON fields
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

    // First, get leads without trying to join on assigneeIds
    const leadsData = await Lead.findAndCountAll({
      offset,
      limit: pageLimit,
      where: {
        ...whereCondition,
        ...(search ? { [Op.and]: searchCondition } : {}),
      },
      order: [["createdAt", "DESC"]],
    });

    // Populate assignees manually based on assigneeIds JSON array
    const rowsWithAssignees = await Promise.all(
      leadsData.rows.map(async (lead) => {
        let assignees: InstanceType<typeof User>[] = [];

        // Get IDs from lead.assigneeIds in a safe way
        let ids: any = lead.assigneeIds;

        // If stored as JSON string in DB, parse it
        if (typeof ids === "string") {
          try {
            ids = JSON.parse(ids);
          } catch {
            ids = [];
          }
        }

        // If it's already a single value, wrap in array
        if (!Array.isArray(ids) && ids != null) {
          ids = [ids];
        }

        // Only fetch if we have valid IDs
        if (Array.isArray(ids) && ids.length > 0) {
          // Convert all IDs to numbers just in case
          const numericIds = ids.map((id) => Number(id)).filter((n) => !isNaN(n));

          if (numericIds.length > 0) {
            assignees = await User.findAll({
              where: { id: numericIds },
              attributes: ["id", "firstname","lastname", "email"], // Add other fields if needed
            });
          }
        }

        return { ...lead.toJSON(), assignees };
      })
    );

    // Return with pagination
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
): Promise<LeadAttributes[]> => {
  try {
    const leads = await Lead.findAll({ where: { campaignName } });
    return leads.map((lead) => lead.get());
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
export const assignLeadToUser = async (
  leadId: number,
  userIdToAssign: number,
  assignedByUserId?: number
): Promise<LeadAttributes> => {
  try {
    const lead = await Lead.findByPk(leadId);
    if (!lead) {
      throw new Error("Lead not found");
    }

    const currentAssignees = lead.assigneeIds || [];

    // ✅ Prevent duplicate assignment
    if (currentAssignees.includes(userIdToAssign)) {
      throw new Error(
        `Lead ID ${leadId} is already assigned to user ID ${userIdToAssign}`
      );
    }

    // ✅ Add the new user to the assignee list
    const updatedAssignees = [...currentAssignees, userIdToAssign];
    await lead.update({ assigneeIds: updatedAssignees });

    // ✅ Optional logging and notification
    if (assignedByUserId) {
      await logActivity(
        assignedByUserId,
        "assign",
        `Lead ID ${leadId} assigned to user ID ${userIdToAssign}`
      );

      await sendNotification(
        userIdToAssign,
        `You have been assigned a new lead (ID: ${leadId})`
      );
    }

    return lead.get();
  } catch (error: any) {
    throw new Error(`Error assigning lead: ${error.message}`);
  }
};

export const getAllLeadsWithAssignee = async () => {
  try {
    const leads = await Lead.findAll({
      where: Sequelize.literal("JSON_LENGTH(assigneeIds) > 0"), // ✅ At least one assignee
    });

    return leads;
  } catch (error: any) {
    throw new Error(`Error fetching leads with assignees: ${error.message}`);
  }
};

export const getAssignmentCounts = async () => {
  const assignedCount = await Lead.count({
    where: Sequelize.literal("JSON_LENGTH(assigneeIds) > 0"), // ✅ Has at least one ID
  });

  const unassignedCount = await Lead.count({
    where: Sequelize.literal("JSON_LENGTH(assigneeIds) = 0"), // ✅ No IDs
  });

  return {
    assignedCount,
    unassignedCount,
  };
};

export const getUnassignedLeads = async () => {
  const unassignedLeads = await Lead.findAll({
    where: Sequelize.literal("JSON_LENGTH(assigneeIds) = 0"), // ✅ No IDs
  });

  return unassignedLeads;
};

export const getLeadsByAssigneeId = async (assigneeId: number) => {
  try {
    const leads = await Lead.findAll({
      where: Sequelize.literal(`JSON_CONTAINS(assigneeIds, '[${assigneeId}]')`), // ✅ Check if array contains the userId
    });

    return leads;
  } catch (error: any) {
    throw new Error(
      `Error fetching leads for assignee ID ${assigneeId}: ${error.message}`
    );
  }
};

// ✅ Corrected function
export const sendEmailToLeadUsingTemplate = async (
  leadId: number,
  templateKey: string, // e.g., "user:create"
  senderUserId: number
) => {
  console.log("Fetching lead with ID:", leadId); // Debug log
  const lead = await Lead.findByPk(leadId);
  if (!lead) {
    console.error("Lead not found for ID:", leadId);
    throw new Error("Lead not found");
  }
  // Parse leadData if it's a string
  let leadData;
  if (typeof lead.leadData === "string") {
    try {
      leadData = JSON.parse(lead.leadData);
      console.log("Parsed leadData:", leadData); // Debug log
    } catch (error: any) {
      console.error("Error parsing leadData for ID:", leadId, error.message);
      throw new Error("Invalid leadData format");
    }
  } else {
    leadData = lead.leadData;
    console.log("leadData (already parsed):", leadData); // Debug log
  }
  const email = leadData?.email;
  if (!email) {
    console.error("No email found in leadData for ID:", leadId, leadData);
    throw new Error("Lead email not found in leadData");
  }
  const sender = await User.findByPk(senderUserId);
  const senderRole = String(sender?.role || "guest");
  // const canSend = await checkEmailPermission(templateKey, senderRole);
  // if (!canSend) throw new Error("You are not authorized to send this email");
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
  return { message: "Email sent successfully", to: email };
};
// ✅ Helper: replace {{key}} in text with values from leadData
function fillTemplate(template: string, data: any): string {
  return template.replace(/{{(.*?)}}/g, (_, key) => {
    const trimmedKey = key.trim();
    return data?.[trimmedKey] || "";
  });
}
