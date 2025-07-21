import Lead, {
  LeadAttributes,
  LeadCreationAttributes,
} from "../models/lead.model";
import { buildSearchFilter } from "../utils/filterQuery";
import { getPagination, getPagingData } from "../utils/paginate";
import { logActivity } from "./activity.service";
import { sendNotification } from "./notification.service";

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

// Get All Leads
export const getAllLeads = async ({
  page = 1,
  limit = 10,
  filters = {},
  search = "",
}: LeadQueryParams) => {
  try {
    const { offset, limit: pageLimit } = getPagination({ page, limit });

    // Use fields that are searchable for leads
    const searchableFields = ["leadData", "email", "phone", "source"];

    const searchFilter = buildSearchFilter(search, searchableFields);

    const whereCondition = {
      ...filters,
      ...searchFilter,
    };

    const data = await Lead.findAndCountAll({
      offset,
      limit: pageLimit,
      where: whereCondition,
      order: [["created_at", "DESC"]],
    });

    return getPagingData(data, page, pageLimit);
  } catch (error: any) {
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
export const deleteLead = async (id: number, userId?: number): Promise<void> => {
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
