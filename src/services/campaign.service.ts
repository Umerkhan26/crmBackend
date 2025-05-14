import Campaign from "../models/campaign.model";
import {
  CampaignAttributes,
  CampaignCreationAttributes,
} from "../models/campaign.model";

export const createCampaign = async (
  data: CampaignCreationAttributes[]
): Promise<CampaignAttributes[]> => {
  try {
    if (!data || data.length === 0) {
      throw new Error("No campaign data provided.");
    }

    const campaignName = data[0].campaignName;
    if (!campaignName) {
      throw new Error("Campaign name is missing.");
    }

    // ❌ Don't add required fields again, assuming they are sent from frontend
    const created = await Campaign.bulkCreate(data);
    return created.map((c) => c.get());
  } catch (error: any) {
    console.error("Error creating campaign:", error);
    throw new Error(`Error creating campaign: ${error.message}`);
  }
};

// ✅ Get all campaigns (all fields)
export const getAllCampaigns = async (): Promise<CampaignAttributes[]> => {
  try {
    const campaigns = await Campaign.findAll();
    return campaigns.map((c) => c.get());
  } catch (error: any) {
    throw new Error(`Error retrieving campaigns: ${error.message}`);
  }
};

// ✅ Get all fields by campaign ID
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

// ✅ Update a specific field by ID
export const updateCampaign = async (
  id: number,
  data: CampaignCreationAttributes
): Promise<CampaignAttributes | null> => {
  try {
    const campaign = await Campaign.findByPk(id);
    if (!campaign) {
      throw new Error("Campaign field not found");
    }

    await campaign.update({
      col_name: data.col_name,
      col_slug: data.col_slug,
      col_type: data.col_type,
      default_value: data.default_value,
      options: data.options,
      multiple: data.multiple,
      dynamic_fields: data.dynamic_fields,
    });

    return campaign.get();
  } catch (error: any) {
    throw new Error(`Error updating campaign: ${error.message}`);
  }
};

// ✅ Delete a specific field by ID
// export const deleteCampaign = async (id: number): Promise<boolean> => {
//   try {
//     const campaign = await Campaign.findByPk(id);
//     if (!campaign) {
//       throw new Error("Campaign field not found");
//     }
//     await campaign.destroy();
//     return true;
//   } catch (error: any) {
//     throw new Error(`Error deleting campaign: ${error.message}`);
//   }
// };

export const deleteCampaign = async (id: number): Promise<boolean> => {
  try {
    const campaign = await Campaign.findByPk(id);

    if (!campaign) {
      throw new Error("Campaign field not found");
    }

    const campaignName = campaign.get("campaignName"); // safer and avoids TS error

    await Campaign.destroy({
      where: { campaignName },
    });

    return true;
  } catch (error: any) {
    throw new Error(`Error deleting campaign: ${error.message}`);
  }
};
