import Campaign from "../models/campaign.model";
import {
  CampaignAttributes,
  CampaignCreationAttributes,
} from "../models/campaign.model";
import { buildSearchFilter } from "../utils/filterQuery";
import { getPagination, getPagingData } from "../utils/paginate";
import { logActivity } from "./activity.service";
import { sendNotification } from "./notification.service";
import Permission from "../models/permission.model";
import User from "../models/user.model";
import Role from "../models/role.model";
import RolePermission from "../models/rolePermission.model";
import Order from "../models/order.model";
import { Op, Sequelize } from "sequelize";

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
    throw new Error(`Error creating campaign: ${error.message}`);
  }
};

/**
 * Ensures each campaign has a getCampaignById permission row (Create Role, Assigned Leads, etc.).
 * Safe to run repeatedly. Does not attach new permissions to roles — admins assign those in Create Role.
 */
export const ensureGetCampaignPermissionsForAllCampaigns = async (): Promise<{
  created: number;
  existing: number;
}> => {
  let created = 0;
  let existing = 0;
  const campaigns = await Campaign.findAll({
    attributes: ["id", "campaignName"],
  });
  const fallbackUser =
    (await User.findOne({
      order: [["id", "ASC"]],
      attributes: ["id"],
    })) ?? null;
  if (!fallbackUser?.id) {
    throw new Error("No user in database to attach new campaign permissions");
  }
  const userId = fallbackUser.id;

  for (const row of campaigns) {
    const id = row.id;
    const campaignName = String(row.campaignName || "").trim();
    if (!campaignName) continue;
    const resourceType = `campaign-${campaignName}`;
    const scopedLower = resourceType.toLowerCase();

    const already = await Permission.findOne({
      where: {
        name: "getCampaignById",
        [Op.or]: [
          { resourceId: id },
          { resourceType },
          Sequelize.where(
            Sequelize.fn(
              "LOWER",
              Sequelize.fn("TRIM", Sequelize.col("resourceType")),
            ),
            scopedLower,
          ),
        ],
      },
    });
    if (already) {
      existing++;
      continue;
    }
    await Permission.create({
      name: "getCampaignById",
      resourceType,
      resourceId: id,
      userId,
    });
    created++;
  }
  return { created, existing };
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

export const getCampaignByName = async (
  name: string
): Promise<CampaignAttributes[]> => {
  try {
    const campaignEntry = await Campaign.findOne({
      where: { campaignName: name },
    });
    if (!campaignEntry) return [];

    const campaignFields = await Campaign.findAll({
      where: { campaignName: campaignEntry.campaignName },
    });
    return campaignFields.map((c) => c.get());
  } catch (error: any) {
    throw new Error(`Error retrieving campaign by name: ${error.message}`);
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
        ":x: Cannot update campaign: it is linked to existing orders."
      );
    }
    const campaign = await Campaign.findByPk(id);
    if (!campaign) throw new Error("Campaign not found");
    const oldName = campaign.campaignName;
    const newName = data.campaignName;
    campaign.campaignName = newName;
    campaign.fields = data.fields;
    await campaign.save();
    if (oldName !== newName) {
      const oldResourceType = `campaign-${oldName}`;
      const newResourceType = `campaign-${newName}`;
      await Permission.update(
        { resourceType: newResourceType },
        { where: { resourceType: oldResourceType } }
      );

    }
    if (userId) {
      await logActivity(
        userId,
        "Campaign Updated",
        `Updated campaign "${oldName}" → "${newName}"`
      );
      await sendNotification(
        userId,
        `Campaign "${oldName}" has been renamed to "${newName}".`
      );
    }
    return campaign.get();
  } catch (err: any) {
    throw new Error(err.message || "Error updating campaign");
  }
};
export const deleteCampaign = async (
  id: number,
  userId?: number
): Promise<boolean> => {
  try {
    const orderExists = await Order.count({ where: { campaign_id: id } });
    if (orderExists > 0) {
      throw new Error(
        ":x: Cannot delete campaign: It is linked to existing orders."
      );
    }
    const campaign = await Campaign.findByPk(id);
    if (!campaign) throw new Error("Campaign not found");
    const campaignName = campaign.campaignName;
    const resourceTypeId = `campaign-${id}`;
    const resourceTypeName = `campaign-${campaignName}`;
    const scopedTypeLower = `campaign-${String(campaignName).trim()}`.toLowerCase();
    // Remove getCampaignById rows for this campaign: exact resourceType / id,
    // plus case-insensitive `campaign-<name>` so spelling variants do not leave orphans.
    // (Do not match on bare campaign name — avoids touching similarly named campaigns.)
    const permissions = await Permission.findAll({
      where: {
        [Op.and]: [
          { name: "getCampaignById" },
          {
            [Op.or]: [
              { resourceType: resourceTypeId },
              { resourceType: resourceTypeName },
              { resourceId: id },
              Sequelize.where(
                Sequelize.fn(
                  "LOWER",
                  Sequelize.fn("TRIM", Sequelize.col("resourceType")),
                ),
                scopedTypeLower,
              ),
            ],
          },
        ],
      },
    });
    if (permissions.length > 0) {
      const permissionIds = permissions.map((p) => p.id);
      await RolePermission.destroy({ where: { permissionId: permissionIds } });
      await Permission.destroy({ where: { id: permissionIds } });
    }
    await Campaign.destroy({ where: { id } });
    if (userId) {
      await logActivity(
        userId,
        "Campaign Deleted",
        `Deleted campaign "${campaignName}" and its related permissions.`
      );
      await sendNotification(
        userId,
        `Campaign "${campaignName}" and its related permissions have been deleted.`
      );
    }
    return true;
  } catch (err: any) {
    throw new Error(err.message || "Error deleting campaign");
  }
};
