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

    // Build search condition
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
      order: [["createdAt", "DESC"]],
    });

    return getPagingData(data, page, pageLimit);
  } catch (error: any) {
    console.error("Error in getAllLeads:", error.stack);
    throw new Error(`Error fetching leads: ${error.message}`);
  }
};

// Get Leads by Campaign
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

    // Use the correct field: assigneeId
    await lead.update({ assigneeId: userIdToAssign });

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

export const getLeadWithAssignee = async (leadId: number) => {
  try {
    const lead = await Lead.findByPk(leadId, {
      include: [
        {
          model: User,
          as: "assignee", // must match the alias from association
          attributes: ["id", "username", "email"], // select only necessary fields
        },
      ],
    });

    if (!lead) throw new Error("Lead not found");

    return lead;
  } catch (error: any) {
    throw new Error(`Error fetching lead with assignee: ${error.message}`);
  }
};

export const getAssignmentCounts = async (leadId: number) => {
  // Fetch the lead to get the assigned user
  const lead = await Lead.findByPk(leadId);

  // Get all users
  const totalUsers = await User.count();

  // Count if the lead has a user assigned
  const assignedCount = lead?.assigneeId ? 1 : 0;
  const unassignedCount = totalUsers - assignedCount;

  return {
    assignedCount,
    unassignedCount,
  };
};

// Get all users not assigned to the given lead
export const getUnassignedUsersToLead = async (leadId: number) => {
  const lead = await Lead.findByPk(leadId);

  const assignedUserId = lead?.assigneeId;

  const unassignedUsers = await User.findAll({
    where: {
      id: {
        [Op.notIn]: assignedUserId ? [assignedUserId] : [],
      },
    },
    attributes: ["id", "username", "email", "role"],
  });

  return unassignedUsers;
};