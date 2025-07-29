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

    const data = await Lead.findAndCountAll({
      offset,
      limit: pageLimit,
      where: {
        ...whereCondition,
        ...(search ? { [Op.and]: searchCondition } : {}),
      },
      include: [
        {
          model: User,
          as: "assignee",
          attributes: ["id", "firstname", "email"], // Add other fields if needed
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    return getPagingData(data, page, pageLimit);
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


//   leadId: number,
//   userIdToAssign: number,
//   assignedByUserId?: number
// ): Promise<LeadAttributes> => {
//   try {
//     const lead = await Lead.findByPk(leadId);
//     if (!lead) {
//       throw new Error("Lead not found");
//     }

//     // Use the correct field: assigneeId
//     await lead.update({ assigneeId: userIdToAssign });

//     if (assignedByUserId) {
//       await logActivity(
//         assignedByUserId,
//         "assign",
//         `Lead ID ${leadId} assigned to user ID ${userIdToAssign}`
//       );

//       await sendNotification(
//         userIdToAssign,
//         `You have been assigned a new lead (ID: ${leadId})`
//       );
//     }

//     return lead.get();
//   } catch (error: any) {
//     throw new Error(`Error assigning lead: ${error.message}`);
//   }
// };

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

    // ✅ Prevent reassigning if already assigned to the same user
    if (lead.assigneeId === userIdToAssign) {
      throw new Error(
        `Lead ID ${leadId} is already assigned to user ID ${userIdToAssign}`
      );
    }

    // ✅ Proceed with assignment
    await lead.update({ assigneeId: userIdToAssign });

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
      include: [
        {
          model: User,
          as: "assignee",
          attributes: ["id", "firstname", "email"],
          required: true, // ensures only leads with an assignee are returned
        },
      ],
    });

    return leads;
  } catch (error: any) {
    throw new Error(`Error fetching leads with assignees: ${error.message}`);
  }
};

export const getAssignmentCounts = async () => {
  const assignedCount = await Lead.count({
    where: {
      assigneeId: {
        [Op.not]: null as any,
      },
    },
  });

  const unassignedCount = await Lead.count({
    where: {
      assigneeId: {
        [Op.is]: null as any,
      },
    },
  });

  return {
    assignedCount,
    unassignedCount,
  };
};
// Get all leads with no assignee

export const getUnassignedLeads = async () => {
  const unassignedLeads = await Lead.findAll({
    where: {
      assigneeId: {
        [Op.is]: null,
      },
    } as any, // 👈 type assertion to bypass TS conflict
    include: [
      {
        model: User,
        as: "assignee",
        attributes: ["id", "firstname", "email"],
        required: false,
      },
    ],
  });

  return unassignedLeads;
};


export const getLeadsByAssigneeId = async (assigneeId: number) => {
  try {
    const leads = await Lead.findAll({
      where: { assigneeId },
      include: [
        {
          model: User,
          as: "assignee",
          attributes: ["id", "firstname", "email"],
        },
      ],
    });

    return leads;
  } catch (error: any) {
    throw new Error(`Error fetching leads for assignee ID ${assigneeId}: ${error.message}`);
  }
};

// ✅ Corrected function
export const sendEmailToLeadUsingTemplate = async (
  leadId: number,
  templateKey: string,       // e.g., "user:create"
  senderUserId: number       // current user sending the email
) => {
  // ✅ Fetch lead
  const lead = await Lead.findByPk(leadId);
  if (!lead) throw new Error("Lead not found");

  const email = lead.leadData?.email;
  if (!email) throw new Error("Lead email not found in leadData");

  // ✅ Fetch sender user and their role (for permission check)
  const sender = await User.findByPk(senderUserId);
const senderRole = String(sender?.role || "guest");

  // ✅ Check permission for this email type
  const canSend = await checkEmailPermission(templateKey, senderRole);
  if (!canSend) throw new Error("You are not authorized to send this email");

  // ✅ Fetch the template
  const template = await EmailTemplate.findOne({ where: { serviceName: templateKey } });
  if (!template) throw new Error("Email template not found");

  // ✅ Replace placeholders in subject/body
  const filledSubject = fillTemplate(template.subjectTemplate, lead.leadData);
  const filledBody = fillTemplate(template.bodyTemplate, lead.leadData);

  // ✅ Get SMTP config for current sender
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

  // ✅ Send email
  await sendEmail({
    smtp,
    to: email,
    subject: filledSubject,
    body: filledBody,
  });

  // ✅ Log email send
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
