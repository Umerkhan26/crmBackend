import { Request, Response } from "express";
import * as CampaignService from "../services/campaign.service";

// ✅ Create Campaign
export const createCampaignn = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const { campaignName, fields } = req.body;
    const userId = (req as any).user?.id;

    if (!campaignName || !Array.isArray(fields) || fields.length === 0) {
      return res.status(400).json({
        message: "Invalid data. Must include campaignName and at least one field.",
      });
    }

    const campaignData = [
      {
        campaignName,
        fields: fields.map((field: any) => ({
          col_name: field.col_name,
          col_slug: field.col_slug,
          col_type: field.col_type,
          default_value:
            field.default_value !== undefined
              ? String(field.default_value)
              : undefined,
          options: field.options,
          multiple: field.multiple,
          dynamic_fields: field.dynamic_fields || null,
        })),
      },
    ];

    const campaign = await CampaignService.createCampaign(campaignData, userId);

    return res.status(201).json({
      message: "Campaign created successfully",
      campaign,
    });
  } catch (error: any) {
    console.error("Error in createCampaign controller:", error);
    return res.status(500).json({
      message: `Error creating campaign: ${error.message}`,
    });
  }
};

// ✅ Get all campaigns, grouped by campaignName
export const getAllCampaigns = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = (req.query.search as string) || "";

    const campaignsResult = await CampaignService.getAllCampaigns({ page, limit, search });

    if (!campaignsResult || campaignsResult.data.length === 0) {
      return res.status(404).json({ message: "No campaigns found" });
    }

    const grouped = campaignsResult.data.reduce((acc: any, field: any) => {
      const name = field.campaignName;
      if (!acc[name]) acc[name] = [];
      acc[name].push(field);
      return acc;
    }, {});

    return res.status(200).json({
      success: true,
      message: "Campaigns fetched successfully",
      groupedCampaigns: grouped,
      totalItems: campaignsResult.totalItems,
      totalPages: campaignsResult.totalPages,
      currentPage: campaignsResult.currentPage,
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

// ✅ Get fields for a campaign by ID
export const getCampaignById = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const { id } = req.params;
    const fields = await CampaignService.getCampaignById(Number(id));

    if (!fields || fields.length === 0) {
      return res.status(404).json({ message: "Campaign not found" });
    }

    return res.status(200).json({
      campaignName: fields[0].campaignName,
      fields,
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

// ✅ Update Campaign (with userId for activity/notification)
export const updateCampaign = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const { id } = req.params;
    const data = req.body;
    const userId = (req as any).user?.id;

    const updated = await CampaignService.updateCampaign(Number(id), data, userId);

    if (!updated) {
      return res.status(404).json({ message: "Campaign not found" });
    }

    return res.status(200).json({ message: "Campaign updated", updated });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

// ✅ Delete Campaign (with userId for activity/notification)
export const deleteCampaign = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;

    const success = await CampaignService.deleteCampaign(Number(id), userId);

    if (!success) {
      return res.status(404).json({ message: "Field not found in campaign" });
    }

    return res.status(200).json({ message: "Field deleted successfully" });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};
