import { Request, Response } from "express";
import * as LeadService from "../services/lead.service";
import { LeadStatus } from "../models/lead.model";
import { FilterType } from "../utils/dateFilters";
import { getPagingData } from "../utils/paginate";

export const createLead = async (req: Request, res: Response): Promise<any> => {
  try {
    const { campaignName, leadData } = req.body;

    if (!campaignName || !leadData || typeof leadData !== "object") {
      return res.status(400).json({ message: "Invalid lead data." });
    }

    const lead = await LeadService.createLead({ campaignName, leadData });
    return res.status(201).json({ message: "Lead created successfully", lead });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const getAllLeads = async (req: Request, res: Response): Promise<any> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    const search = (req.query.search as string) || "";
    const campaign = req.query.campaign as string;

    const filterType = req.query.filterType as FilterType;
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;

    const filters: any = {};

    if (req.query.status) filters.status = req.query.status;
    if (req.query.campaign_id)
      filters.campaign_id = Number(req.query.campaign_id);

    // ⭐ Read dynamic JSON filters from query
    let conditions: any[] = [];
    if (req.query.conditions) {
      try {
        conditions = JSON.parse(req.query.conditions as string);
      } catch (e) {
        console.log("Invalid conditions format");
      }
    }

    const leadsData = await LeadService.getAllLeads({
      page,
      limit,
      search,
      filters,
      campaign,
      filterType,
      startDate,
      endDate,
      conditions, // ⭐ pass dynamic filters
    });

    return res.status(200).json({
      success: true,
      message: "Leads fetched successfully",
      ...leadsData,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || "An error occurred while fetching leads",
    });
  }
};


export const getLeadById = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const { id } = req.params;

    if (!id || isNaN(Number(id))) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid lead ID." });
    }

    const lead = await LeadService.getLeadById(Number(id));

    return res.status(200).json({
      success: true,
      message: "Lead fetched successfully",
      data: lead,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || "An error occurred while fetching the lead",
    });
  }
};

export const getLeadsByCampaign = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const { campaignName } = req.params;
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit
      ? parseInt(req.query.limit as string, 10)
      : 10;

    const search = req.query.search ? String(req.query.search) : ""; // <-- ADD THIS

    const leads = await LeadService.getLeadsByCampaign({
      campaignName,
      page,
      limit,
      search, // <-- PASS THIS
    });

    if (!leads || !leads.rows || leads.rows.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No leads found for this campaign",
        data: [],
        totalItems: 0,
        totalPages: 0,
        currentPage: page,
      });
    }

    return res.status(200).json({
      success: true,
      ...leads,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};


export const updateLead = async (req: Request, res: Response): Promise<any> => {
  try {
    const leadId = parseInt(req.params.id, 10);
    const updatedData = req.body;

    if (isNaN(leadId)) {
      return res.status(400).json({ message: "Invalid lead ID" });
    }

    const updatedLead = await LeadService.updateLead(leadId, updatedData);
    return res
      .status(200)
      .json({ message: "Lead updated successfully", lead: updatedLead });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const deleteLead = async (req: Request, res: Response): Promise<any> => {
  try {
    const leadId = parseInt(req.params.id, 10);

    if (isNaN(leadId)) {
      return res.status(400).json({ message: "Invalid lead ID" });
    }

    await LeadService.deleteLead(leadId);
    return res.status(200).json({ message: "Lead deleted successfully" });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};
export const assignUserToLead = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const leadId = parseInt(req.params.leadId, 10);
    const assignedByUserId = req.user?.id;

    let userIds: number[] = [];

    if (Array.isArray(req.body.userIds)) {
      userIds = req.body.userIds
        .map((id: string | number) => parseInt(id as string, 10))
        .filter((id: number) => !isNaN(id));
    }
    else if (req.body.userId) {
      const singleId = parseInt(req.body.userId, 10);
      if (!isNaN(singleId)) {
        userIds = [singleId];
      }
    }

    if (isNaN(leadId) || userIds.length === 0) {
      return res.status(400).json({ message: "Invalid lead ID or user IDs." });
    }

    const updatedLead = await LeadService.assignLeadToUsers(
      leadId,
      userIds,
      assignedByUserId
    );

    return res.status(200).json({
      success: true,
      message: `User(s) ${userIds.join(
        ", "
      )} have been assigned to lead ID ${leadId}.`,
      lead: updatedLead,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message:
        error.message || "An error occurred while assigning user(s) to lead.",
    });
  }
};

export const getAllLeadsWithAssignee = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit
      ? parseInt(req.query.limit as string, 10)
      : 10;
    const search = req.query.search ? (req.query.search as string).trim() : "";
    const campaign = req.query.campaign
      ? (req.query.campaign as string)
      : undefined;
    const filterType = req.query.filterType
      ? (req.query.filterType as FilterType)
      : undefined;
    const startDate = req.query.startDate
      ? (req.query.startDate as string)
      : undefined;
    const endDate = req.query.endDate
      ? (req.query.endDate as string)
      : undefined;
    let conditions: any[] = [];
    if (req.query.conditions) {
      try {
        conditions = JSON.parse(req.query.conditions as string);
        console.log(":clipboard: Backend received conditions:", conditions);
      } catch (error) {
        console.error("Error parsing conditions:", error);
      }
    }
    const leads = await LeadService.getAllLeadsWithAssignee({
      page,
      limit,
      search,
      campaign,
      filterType,
      startDate,
      endDate,
      conditions,
    });
    if (!leads || !leads.data || leads.data.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No leads found",
        data: [],
        totalItems: 0,
        totalPages: 0,
        currentPage: page,
      });
    }
    return res.status(200).json({
      success: true,
      ...leads,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};
export const getLeadsByAssigneeId = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const assigneeId = parseInt(req.params.assigneeId, 10);
    const filterType = (req.query.filterType as FilterType) || "daily";
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const campaignName = req.query.campaignName as string | undefined;

    if (isNaN(assigneeId)) {
      return res.status(400).json({ message: "Invalid assignee ID." });
    }

    const leadsResult = await LeadService.getLeadsByAssigneeId(
      assigneeId,
      filterType,
      startDate,
      endDate,
      page,
      limit,
      campaignName
    );

    const responseData = getPagingData(leadsResult, page, limit);

    return res.status(200).json({
      success: true,
      message: `Leads assigned to user ID ${assigneeId} fetched successfully.`,
      ...responseData,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || "An error occurred while fetching leads.",
    });
  }
};

export const getAssignmentStats = async (req: Request, res: Response) => {
  try {
    const stats = await LeadService.getAssignmentCounts();
    res.status(200).json(stats);
  } catch (error) {
    res.status(500).json({ error: "Failed to get assignment stats" });
  }
};

export const getUnassignedLeads = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit
      ? parseInt(req.query.limit as string, 10)
      : 10;
    const searchTerm = req.query.search
      ? (req.query.search as string).trim()
      : "";

    const campaign = req.query.campaign
      ? (req.query.campaign as string)
      : undefined;

    const filterType = req.query.filterType
      ? (req.query.filterType as FilterType)
      : undefined;

    const startDate = req.query.startDate
      ? (req.query.startDate as string)
      : undefined;
    const endDate = req.query.endDate
      ? (req.query.endDate as string)
      : undefined;

    const leads = await LeadService.getUnassignedLeads({
      page,
      limit,
      searchTerm,
      campaign,
      filterType,
      startDate,
      endDate,
    });

    if (!leads || !leads.data || leads.data.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No unassigned leads found",
        data: [],
        totalItems: 0,
        totalPages: 0,
        currentPage: page,
      });
    }

    return res.status(200).json({
      success: true,
      ...leads,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch unassigned leads",
      error: error.message,
    });
  }
};

export const sendEmailToLead = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const leadId = parseInt(req.params.leadId, 10);
    const templateKey = req.body.templateKey;
    const senderUserId = req.user?.id;

    if (isNaN(leadId)) {
      return res.status(400).json({ message: "Invalid lead ID." });
    }

    if (!templateKey) {
      return res
        .status(400)
        .json({ message: "Email template key is required." });
    }

    if (!senderUserId) {
      return res
        .status(401)
        .json({ message: "Unauthorized. User not authenticated." });
    }

    const result = await LeadService.sendEmailToLeadUsingTemplate(
      leadId,
      templateKey,
      senderUserId
    );

    return res.status(200).json({
      success: true,
      message: result.message,
      to: result.to,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message:
        error.message || "An error occurred while sending email to lead.",
    });
  }
};

export const getLeadStatusSummary = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const assigneeId = req.query.assigneeId
      ? parseInt(req.query.assigneeId as string, 10)
      : undefined;

    const result = await LeadService.getLeadStatusSummary(assigneeId);

    return res.status(200).json({
      success: true,
      message: "Lead status summary fetched successfully",
      data: result,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message:
        error.message || "An error occurred while fetching status summary.",
    });
  }
};

const ALLOWED_STATUSES: LeadStatus[] = [
  "pending",
  "sold",
  "most_interested",
  "to_call",
  "not_interested",
];
export const updateLeadStatus = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const leadId = Number(req.params.leadId);
    const userId = Number(req.body.userId);
    const status = req.body.status as LeadStatus;

    if (!leadId || !userId || !status) {
      return res.status(400).json({
        success: false,
        message: "Lead ID, user ID, and status are required",
      });
    }

    if (!ALLOWED_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Allowed statuses: ${ALLOWED_STATUSES.join(
          ", "
        )}`,
      });
    }

    const updatedLead = await LeadService.updateLeadStatusForUser(
      leadId,
      userId,
      status
    );

    return res.status(200).json({
      success: true,
      message: `Status updated to "${status}" for user ${userId} on lead ${leadId}`,
      lead: updatedLead,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || "An error occurred while updating lead status",
    });
  }
};

export const getLeadsByCampaignAndAssignee = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const { campaignName } = req.params;
    const assigneeId = parseInt(req.query.assigneeId as string, 10);

    if (!campaignName || isNaN(assigneeId)) {
      return res
        .status(400)
        .json({ message: "campaignName and valid assigneeId are required" });
    }

    const leads = await LeadService.getLeadsByCampaignAndAssignee(
      campaignName,
      assigneeId
    );

    if (leads.length === 0) {
      return res
        .status(404)
        .json({ message: "No leads found for this campaign and assignee" });
    }

    return res.status(200).json(leads);
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};
