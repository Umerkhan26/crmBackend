import Campaign from "../models/campaign.model";
import {
  CampaignAttributes,
  CampaignCreationAttributes,
} from "../models/campaign.model";
import { buildSearchFilter } from "../utils/filterQuery";
import { getPagination, getPagingData } from "../utils/paginate";
import { logActivity } from "./activity.service";
import { sendNotification } from "./notification.service";
import Permission from "../models/permission.model"; // <-- Add this at the top
import User from "../models/user.model";
import Role from "../models/role.model";
import RolePermission from "../models/rolePermission.model";
import Order from "../models/order.model";

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
    const campaign = created.get();
    const resourceType = `campaign-${campaignName}`;
    if (userId) {
      const permission = await Permission.create({
        name: "getCampaignById",
        resourceType,
        resourceId: campaign.id,
        userId: userId,
      });
      const user = await User.findByPk(userId, {
        include: [
          {
            model: Role,
            as: "role",
            include: [{ model: Permission, as: "Permissions" }],
          },
        ],
      });
      if (user?.role) {
        try {
          await RolePermission.create({
            roleId: user.role.id,
            permissionId: permission.id,
          });
        } catch (error: any) {
          console.warn(`RolePermisssion creation skipped: ${error.message}`);
        }
      }
      await logActivity(
        userId,
        "Campaign Created",
        `Created campaign "${campaignName}"`
      );
      await sendNotification(
        userId,
        `You have successfully created the campaign "${campaignName}".`
      );
    }
    return campaign;
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
  data: any,
  userId?: number
): Promise<any> => {
  try {
    const orderExists = await Order.count({ where: { campaign_id: id } });
    if (orderExists > 0) {
      throw new Error(
        "❌ Cannot update campaign: it is linked to existing orders."
      );
    }

    const campaign = await Campaign.findByPk(id);
    if (!campaign) throw new Error("Campaign not found");

    const oldName = campaign.campaignName;
    campaign.campaignName = data.campaignName;
    campaign.fields = data.fields;
    await campaign.save();

    if (userId) {
      await logActivity(
        userId,
        "Campaign Updated",
        `Updated campaign "${oldName}"`
      );
      await sendNotification(userId, `Campaign "${oldName}" has been updated.`);
    }

    return campaign.get();
  } catch (err: any) {
    throw new Error(err.message || "Error updating campaign");
  }
};

// export const deleteCampaign = async (
//   id: number,
//   userId?: number
// ): Promise<boolean> => {
//   try {
//     const orderExists = await Order.count({ where: { campaign_id: id } });
//     if (orderExists > 0) {
//       throw new Error(
//         "❌ Cannot delete campaign: it is linked to existing orders."
//       );
//     }

//     const campaign = await Campaign.findByPk(id);
//     if (!campaign) throw new Error("Campaign not found");

//     const name = campaign.campaignName;
//     await Campaign.destroy({ where: { id } });

//     if (userId) {
//       await logActivity(
//         userId,
//         "Campaign Deleted",
//         `Deleted campaign "${name}"`
//       );
//       await sendNotification(userId, `Campaign "${name}" has been deleted.`);
//     }

//     return true;
//   } catch (err: any) {
//     throw new Error(err.message || "Error deleting campaign");
//   }
// };



export const deleteCampaign = async (
  id: number,
  userId?: number
): Promise<boolean> => {
  try {
    // Step 1: Prevent deletion if linked to orders
    const orderExists = await Order.count({ where: { campaign_id: id } });
    if (orderExists > 0) {
      throw new Error(
        "❌ Cannot delete campaign: it is linked to existing orders."
      );
    }

    // Step 2: Find campaign
    const campaign = await Campaign.findByPk(id);
    if (!campaign) throw new Error("Campaign not found");

    const name = campaign.campaignName;
    const resourceType = `campaign-${name}`;

    // Step 3: Find permissions related to this campaign
    const permissions = await Permission.findAll({
      where: { resourceType, resourceId: id },
    });

    if (permissions.length > 0) {
      const permissionIds = permissions.map((p) => p.id);

      // Step 4: Delete from RolePermission first (to avoid FK constraints)
      await RolePermission.destroy({ where: { permissionId: permissionIds } });

      // Step 5: Delete the permissions
      await Permission.destroy({ where: { id: permissionIds } });    
    }

    // Step 6: Delete campaign
    await Campaign.destroy({ where: { id } });

    // Step 7: Log + notify if userId provided
    if (userId) {
      await logActivity(
        userId,
        "Campaign Deleted",
        `Deleted campaign "${name}" and its related permissions.`
      );
      await sendNotification(
        userId,
        `Campaign "${name}" and its related permissions have been deleted.`
      );
    }

    return true;
  } catch (err: any) {
    throw new Error(err.message || "Error deleting campaign");
  }
};
