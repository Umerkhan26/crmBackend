import Campaign from "../models/campaign.model";
import {
  CampaignAttributes,
  CampaignCreationAttributes,
} from "../models/campaign.model";
import { buildSearchFilter } from "../utils/filterQuery";
import { getPagination, getPagingData } from "../utils/paginate";
import { logActivity } from "./activity.service";
import { sendNotification } from "./notification.service";

interface PaginationParams {
  page?: number;
  limit?: number;
}

export const createCampaign = async (
  data: CampaignCreationAttributes[],
  userId?: number
): Promise<CampaignAttributes> => {
  try {
    if (!data || data.length === 0) {
      throw new Error("No campaign data provided.");
    }

    const campaignName = data[0].campaignName;
    if (!campaignName) {
      throw new Error("Campaign name is missing.");
    }

    const fields = data[0].fields;

    const created = await Campaign.create({
      campaignName,
      fields,
    });

    if (userId) {
      await logActivity(userId, "Campaign Created", `Created campaign "${campaignName}"`);
      await sendNotification(userId, `You have successfully created the campaign "${campaignName}".`);
    }

    return created.get();
  } catch (error: any) {
    console.error("Error creating campaign:", error);
    throw new Error(`Error creating campaign: ${error.message}`);
  }
};

export const getAllCampaigns = async ({
  page = 1,
  limit = 10,
  search = "",
}: {
  page: number;
  limit: number;
  search?: string;
}) => {
  try {
    const { offset, limit: pageLimit } = getPagination({ page, limit });

    const searchFilter = buildSearchFilter(search, ["campaignName"]);

    const result = await Campaign.findAndCountAll({
      where: searchFilter,
      offset,
      limit: pageLimit,
    });

    return getPagingData(result, page, pageLimit);
  } catch (error: any) {
    throw new Error(`Error retrieving campaigns: ${error.message}`);
  }
};

export const getCampaignById = async (
  id: number
): Promise<CampaignAttributes[]> => {
  try {
    const campaignEntry = await Campaign.findByPk(id);
    if (!campaignEntry) return [];

    const campaignName = campaignEntry.getDataValue("campaignName");

    const campaignFields = await Campaign.findAll({ where: { campaignName } });
    return campaignFields.map((c) => c.get());
  } catch (error: any) {
    throw new Error(`Error retrieving campaign: ${error.message}`);
  }
};

export const updateCampaign = async (
  id: number,
  data: { campaignName: string; fields: any[] },
  userId?: number
): Promise<any> => {
  try {
    const existingCampaign = await Campaign.findOne({ where: { id } });

    if (!existingCampaign) {
      throw new Error("Campaign not found");
    }

    const oldName = existingCampaign.campaignName;

    existingCampaign.campaignName = data.campaignName;
    existingCampaign.fields = data.fields;

    await existingCampaign.save();

    if (userId) {
      await logActivity(userId, "Campaign Updated", `Updated campaign "${oldName}" to "${data.campaignName}"`);
      await sendNotification(userId, `Campaign "${oldName}" has been updated.`);
    }

    return existingCampaign.get();
  } catch (error: any) {
    throw new Error(`Error updating campaign: ${error.message}`);
  }
};

export const deleteCampaign = async (
  id: number,
  userId?: number
): Promise<boolean> => {
  try {
    const campaign = await Campaign.findByPk(id);

    if (!campaign) {
      throw new Error("Campaign field not found");
    }

    const campaignName = campaign.get("campaignName");

    await Campaign.destroy({
      where: { campaignName },
    });

    if (userId) {
      await logActivity(userId, "Campaign Deleted", `Deleted campaign "${campaignName}"`);
      await sendNotification(userId, `Campaign "${campaignName}" has been deleted.`);
    }

    return true;
  } catch (error: any) {
    throw new Error(`Error deleting campaign: ${error.message}`);
  }
};
