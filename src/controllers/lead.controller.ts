import { Request, Response } from "express";
import * as LeadService from "../services/lead.service";
import { getIncomingLeads } from "../services/incomingLead.service";
import { LeadStatus } from "../models/lead.model";
import { FilterType } from "../utils/dateFilters";
import { getPagingData } from "../utils/paginate";
import { PERMISSIONS } from "../constants/permissions";

const canViewAllLeads = (req: Request): boolean => {
  return req.user?.permissions?.includes(PERMISSIONS.LEAD_VIEW_ALL) ?? false;
};

export const createLead = async (req: Request, res: Response): Promise<any> => {
  try {
    const { campaignName, leadData } = req.body;
    const userId = (req as any).user?.id; // Get userId from authenticated user

    if (!campaignName || !leadData || typeof leadData !== "object") {
      return res.status(400).json({ message: "Invalid lead data." });
    }

    const lead = await LeadService.createLead(
      { campaignName, leadData },
      userId,
    );
    return res.status(201).json({ message: "Lead created successfully", lead });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const getAllLeads = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    // Scope is permission-based (no role-name hardcoding)
    const isAdmin = canViewAllLeads(req);

    // Check if user is a manager
    const { isUserManager, getManagerBrandUserIds } = await import("../utils/brandUtils");
    const isManager = await isUserManager(userId);
    const managerBrandUserIds = isManager ? await getManagerBrandUserIds(userId) : [];

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
      userId, // Pass userId to filter by creator
      isAdmin, // Pass isAdmin flag
      isManager, // Pass isManager flag
      managerBrandUserIds, // Pass brand user IDs for manager
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

export const getAdminMasterLeads = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    const isAdmin = canViewAllLeads(req);
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Admin only endpoint.",
      });
    }

    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 10;
    const search = (req.query.search as string) || "";
    const campaign = req.query.campaign as string;
    const filterType = req.query.filterType as FilterType;
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;
    const assignmentStateRaw = String(req.query.assignmentState || "all").toLowerCase();
    const assignmentState =
      assignmentStateRaw === "assigned" || assignmentStateRaw === "unassigned"
        ? assignmentStateRaw
        : "all";
    const contactStateRaw = String(req.query.contactState || "all").toLowerCase();
    const contactState =
      contactStateRaw === "present" || contactStateRaw === "missing"
        ? contactStateRaw
        : "all";

    const filters: any = {};
    if (req.query.status) filters.status = req.query.status;
    if (req.query.campaign_id) filters.campaign_id = Number(req.query.campaign_id);

    let conditions: any[] = [];
    if (req.query.conditions) {
      try {
        conditions = JSON.parse(req.query.conditions as string);
      } catch {
        conditions = [];
      }
    }

    const leadsData = await LeadService.getAllLeads({
      page,
      limit,
      search,
      campaign,
      filterType,
      startDate,
      endDate,
      filters,
      conditions,
      assignmentState,
      contactState,
      isAdmin: true,
      userId,
      // Only leads that came from incoming_leads → `leads` (empty assignees until cron, then assigned).
      onlyPromotedFromIncoming: true,
    });

    const includeStaging =
      String(req.query.includeStaging ?? "true").toLowerCase() !== "false";

    let incomingAwaitingPromotion: Awaited<ReturnType<typeof getIncomingLeads>> | null =
      null;
    if (includeStaging) {
      incomingAwaitingPromotion = await getIncomingLeads({
        page,
        limit,
        search,
        status: "awaiting_promotion",
        campaignName: campaign?.trim() || undefined,
      });
    }

    const incomingSourceRows = (incomingAwaitingPromotion?.data || []) as any[];
    const incomingRows = incomingSourceRows.map((incoming: any) => {
      const payload =
        incoming?.payload && typeof incoming.payload === "object" ? incoming.payload : {};
      const campaignName =
        (incoming?.campaignName && String(incoming.campaignName).trim()) ||
        (payload?.campaignName && String(payload.campaignName).trim()) ||
        "General";

      // Keep a unique id shape so staging ids don't collide with real lead ids in UI tables.
      const syntheticId = `incoming-${incoming.id}`;
      return {
        id: syntheticId,
        sourceType: "incoming_pending",
        incomingLeadId: incoming.id,
        campaignName,
        leadData: payload,
        assignees: [],
        createdAt: incoming.createdAt,
        updatedAt: incoming.updatedAt,
        incomingStatus: incoming.status,
      };
    });

    const mergedRows = includeStaging
      ? [...incomingRows, ...(leadsData.rows || [])]
      : leadsData.rows || [];
    const mergedTotalItems = includeStaging
      ? Number(leadsData.totalItems || 0) + Number(incomingAwaitingPromotion?.totalItems || 0)
      : Number(leadsData.totalItems || 0);

    return res.status(200).json({
      success: true,
      message: "Admin master leads fetched successfully",
      assignmentState,
      contactState,
      ...leadsData,
      rows: mergedRows,
      totalItems: mergedTotalItems,
      incomingAwaitingPromotion,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || "An error occurred while fetching admin master leads",
    });
  }
};

export const getLeadById = async (
  req: Request,
  res: Response,
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
  res: Response,
): Promise<any> => {
  try {
    const { campaignName } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    // Scope is permission-based (no role-name hardcoding)
    const isAdmin = canViewAllLeads(req);

    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit
      ? parseInt(req.query.limit as string, 10)
      : 10;

    const search = req.query.search ? String(req.query.search).trim() : "";

    console.log("🔍 Controller - Received search parameter:", {
      searchTerm: search,
      rawQuery: req.query.search,
      campaignName,
      page,
      limit,
    });

    const startDate = req.query.startDate
      ? (req.query.startDate as string)
      : undefined;

    const endDate = req.query.endDate
      ? (req.query.endDate as string)
      : undefined;

    const filterType = req.query.filterType
      ? (req.query.filterType as FilterType)
      : undefined;
    const onlyExited =
      req.query.onlyExited === undefined
        ? true
        : String(req.query.onlyExited).toLowerCase() !== "false";

    // Dynamic JSON filters
    let conditions: any[] = [];
    if (req.query.conditions) {
      try {
        conditions = JSON.parse(req.query.conditions as string);
      } catch {
        conditions = [];
      }
    }

    // Support createdBy filter for admin users (from URL params)
    const createdBy =
      isAdmin && req.query.createdBy
        ? parseInt(req.query.createdBy as string)
        : undefined;

    // Service call - pass userId and isAdmin to filter leads
    const leads = await LeadService.getLeadsByCampaign({
      campaignName,
      page,
      limit,
      search,
      conditions,
      startDate,
      endDate,
      filterType,
      userId, // Pass userId to filter by creator
      isAdmin, // Pass isAdmin flag
      createdBy, // Add createdBy filter for admin users
      onlyExited,
    });

    if (!leads || !leads.rows || leads.rows.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No leads found for this campaign",
        rows: [],
        totalItems: 0,
        totalPages: 0,
        currentPage: page,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Leads fetched successfully",
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

export const bulkDeleteLeads = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const { leadIds } = req.body || {};
    if (!Array.isArray(leadIds) || leadIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "leadIds must be a non-empty array",
      });
    }

    const ids = leadIds
      .map((id: string | number) => parseInt(String(id), 10))
      .filter((id: number) => !isNaN(id));

    if (ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid lead IDs provided",
      });
    }

    const { deletedCount } = await LeadService.bulkDeleteLeads(ids, req.user?.id);
    return res.status(200).json({
      success: true,
      message: "Bulk lead delete completed",
      deletedCount,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || "An error occurred while bulk deleting leads.",
    });
  }
};
export const assignUserToLead = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const leadId = parseInt(req.params.leadId, 10);
    const assignedByUserId = req.user?.id;

    let userIds: number[] = [];

    if (Array.isArray(req.body.userIds)) {
      userIds = req.body.userIds
        .map((id: string | number) => parseInt(id as string, 10))
        .filter((id: number) => !isNaN(id));
    } else if (req.body.userId) {
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
      assignedByUserId,
    );

    return res.status(200).json({
      success: true,
      message: `User(s) ${userIds.join(
        ", ",
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

export const bulkAssignLeadsToUser = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const assignedByUserId = req.user?.id;
    const { leadIds, userId } = req.body;

    if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid lead IDs. Must be a non-empty array.",
      });
    }

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required.",
      });
    }

    const userIdNum = parseInt(userId, 10);
    if (isNaN(userIdNum)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID.",
      });
    }

    const leadIdsNum = leadIds
      .map((id: string | number) => parseInt(id as string, 10))
      .filter((id: number) => !isNaN(id));

    if (leadIdsNum.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid lead IDs provided.",
      });
    }

    const result = await LeadService.bulkAssignLeadsToUser(
      leadIdsNum,
      userIdNum,
      assignedByUserId,
    );

    return res.status(200).json({
      success: true,
      message: `${result.success} lead(s) assigned successfully. ${result.failed > 0 ? `${result.failed} failed.` : ""}`,
      data: result,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || "An error occurred while bulk assigning leads.",
    });
  }
};

export const getAllLeadsWithAssignee = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    // Scope is permission-based (no role-name hardcoding)
    const isAdmin = canViewAllLeads(req);

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
      userId, // Pass userId to filter by creator
      isAdmin, // Pass isAdmin flag
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
  res: Response,
): Promise<any> => {
  try {
    const assigneeId = parseInt(req.params.assigneeId, 10);
    const filterType = req.query.filterType
      ? (req.query.filterType as FilterType)
      : undefined;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const campaignName = req.query.campaignName as string | undefined;
    const campaignId = req.query.campaignId
      ? parseInt(req.query.campaignId as string, 10)
      : undefined;
    const search = req.query.search ? (req.query.search as string) : undefined;

    const conditions = req.query.conditions
      ? JSON.parse(req.query.conditions as string)
      : [];

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
      campaignName,
      campaignId,
      search,
      conditions,
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
  res: Response,
): Promise<any> => {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    // Scope is permission-based (no role-name hardcoding)
    const isAdmin = canViewAllLeads(req);

    // Check if user is a manager
    const { isUserManager, getManagerBrandUserIds } = await import("../utils/brandUtils");
    const isManager = await isUserManager(userId);
    const managerBrandUserIds = isManager ? await getManagerBrandUserIds(userId) : [];

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

    // Parse dynamic conditions from query if provided
    let conditions: any[] = [];
    if (req.query.conditions) {
      try {
        conditions = JSON.parse(req.query.conditions as string);
        if (!Array.isArray(conditions)) conditions = [];
      } catch {
        conditions = [];
      }
    }

    // Call service
    const leads = await LeadService.getUnassignedLeads({
      page,
      limit,
      searchTerm,
      campaign,
      filterType,
      startDate,
      endDate,
      conditions, // pass dynamic filters to service
      userId, // Pass userId to filter by creator
      isAdmin, // Pass isAdmin flag
      isManager, // Pass isManager flag
      managerBrandUserIds, // Pass brand user IDs for manager
    });

    // If no leads
    if (!leads || !leads.rows || leads.rows.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No unassigned leads found",
        rows: [],
        totalItems: 0,
        totalPages: 0,
        currentPage: page,
      });
    }

    // Success response
    return res.status(200).json({
      success: true,
      message: "Unassigned leads fetched successfully",
      ...leads, // contains: rows, totalItems, totalPages, currentPage, pageSize
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
  res: Response,
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
      senderUserId,
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
  res: Response,
): Promise<any> => {
  try {
    const assigneeId = req.query.assigneeId
      ? parseInt(req.query.assigneeId as string, 10)
      : undefined;
    const period = req.query.period
      ? String(req.query.period).toLowerCase()
      : undefined;
    const startDate = req.query.startDate
      ? String(req.query.startDate)
      : undefined;
    const endDate = req.query.endDate ? String(req.query.endDate) : undefined;

    const campaignName = req.query.campaignName as string | undefined;
    const campaignId = req.query.campaignId
      ? parseInt(req.query.campaignId as string, 10)
      : undefined;

    const result = await LeadService.getLeadStatusSummary(
      assigneeId,
      period,
      startDate,
      endDate,
      campaignName,
      campaignId,
    );

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
  "not_answered",
  "not_interested",
  "hot_lead",
  "lead_rejected",
];
export const updateLeadStatus = async (
  req: Request,
  res: Response,
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
          ", ",
        )}`,
      });
    }

    const updatedLead = await LeadService.updateLeadStatusForUser(
      leadId,
      userId,
      status,
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

export const getManagerHotLeadRequests = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const managerId = req.user?.id;
    if (!managerId) {
      return res.status(401).json({ success: false, message: "User not authenticated" });
    }
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 10;
    const campaignName = req.query.campaignName as string | undefined;
    const campaignId = req.query.campaignId
      ? parseInt(req.query.campaignId as string, 10)
      : undefined;
    const result = await LeadService.getManagerHotLeadRequests({
      managerId,
      page,
      limit,
      campaignName,
      campaignId,
    });
    return res.status(200).json({
      success: true,
      message: "Hot lead requests fetched successfully",
      ...result,
    });
  } catch (error: any) {
    const code = /under your management/i.test(error.message || "") ? 403 : 500;
    return res.status(code).json({ success: false, message: error.message || "Failed to fetch hot lead requests" });
  }
};

export const reviewHotLeadRequest = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const managerId = req.user?.id;
    if (!managerId) {
      return res.status(401).json({ success: false, message: "User not authenticated" });
    }
    const leadId = Number(req.params.leadId);
    const userId = Number(req.body.userId);
    const decision = req.body.decision as "approved" | "rejected";
    const rejectReason = req.body.rejectReason as string | undefined;
    if (!leadId || !userId || (decision !== "approved" && decision !== "rejected")) {
      return res.status(400).json({
        success: false,
        message: "leadId, userId and valid decision (approved/rejected) are required",
      });
    }
    const data = await LeadService.reviewHotLeadRequest({
      managerId,
      leadId,
      userId,
      decision,
      rejectReason,
    });
    return res.status(200).json({
      success: true,
      message: `Hot lead request ${decision} successfully`,
      lead: data,
    });
  } catch (error: any) {
    const msg = error.message || "Failed to review hot lead request";
    const code =
      /not found/i.test(msg) ? 404 :
      /under your management|no pending|not assigned/i.test(msg) ? 403 : 500;
    return res.status(code).json({ success: false, message: msg });
  }
};

export const getMyHotLeadRequests = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "User not authenticated" });
    }
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 10;
    const campaignName = req.query.campaignName as string | undefined;
    const campaignId = req.query.campaignId
      ? parseInt(req.query.campaignId as string, 10)
      : undefined;
    const result = await LeadService.getMyHotLeadRequests({
      userId,
      page,
      limit,
      campaignName,
      campaignId,
    });
    return res.status(200).json({
      success: true,
      message: "My hot lead requests fetched successfully",
      ...result,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch your hot lead requests",
    });
  }
};

export const getLeadsByCampaignAndAssignee = async (
  req: Request,
  res: Response,
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
      assigneeId,
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

export const getAssignmentHistory = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const userId = req.query.userId
      ? parseInt(req.query.userId as string, 10)
      : undefined;
    const campaignName = req.query.campaignName
      ? (req.query.campaignName as string)
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

    // Validate pagination
    if (page < 1 || limit < 1) {
      return res.status(400).json({
        success: false,
        message: "Page and limit must be positive integers",
      });
    }

    // Validate userId if provided
    if (userId !== undefined && isNaN(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid userId",
      });
    }

    const result = await LeadService.getAssignmentHistory({
      page,
      limit,
      userId,
      campaignName,
      filterType,
      startDate,
      endDate,
    });

    return res.status(200).json({
      success: true,
      message: "Assignment history fetched successfully",
      ...result,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message:
        error.message || "An error occurred while fetching assignment history",
    });
  }
};

export const getAssignmentLeads = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const userId = req.query.userId
      ? parseInt(req.query.userId as string, 10)
      : undefined;
    const campaignName = req.query.campaignName
      ? (req.query.campaignName as string)
      : undefined;
    const assignedAt = req.query.assignedAt
      ? (req.query.assignedAt as string)
      : undefined;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = req.query.search ? (req.query.search as string) : undefined;

    if (!userId || isNaN(userId)) {
      return res.status(400).json({
        success: false,
        message: "Valid userId is required",
      });
    }

    if (!campaignName || campaignName.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "campaignName is required",
      });
    }

    if (!assignedAt) {
      return res.status(400).json({
        success: false,
        message: "assignedAt (ISO timestamp) is required",
      });
    }

    // Validate assignedAt is a valid ISO date
    const assignedAtDate = new Date(assignedAt);
    if (isNaN(assignedAtDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: "assignedAt must be a valid ISO timestamp",
      });
    }

    if (page < 1 || limit < 1) {
      return res.status(400).json({
        success: false,
        message: "Page and limit must be positive integers",
      });
    }

    const result = await LeadService.getAssignmentLeads({
      userId,
      campaignName,
      assignedAt,
      page,
      limit,
      search,
    });

    return res.status(200).json({
      success: true,
      message: "Assignment leads fetched successfully",
      ...result,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message:
        error.message || "An error occurred while fetching assignment leads",
    });
  }
};

export const getAssignmentLeadsWithWork = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const userId = req.query.userId
      ? parseInt(req.query.userId as string, 10)
      : undefined;
    const campaignName = req.query.campaignName
      ? (req.query.campaignName as string)
      : undefined;
    const assignedAt = req.query.assignedAt
      ? (req.query.assignedAt as string)
      : undefined;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = req.query.search ? (req.query.search as string) : undefined;

    if (!userId || isNaN(userId)) {
      return res.status(400).json({
        success: false,
        message: "Valid userId is required",
      });
    }

    if (!campaignName) {
      return res.status(400).json({
        success: false,
        message: "campaignName is required",
      });
    }

    if (!assignedAt) {
      return res.status(400).json({
        success: false,
        message: "assignedAt is required",
      });
    }

    const result = await LeadService.getAssignmentLeadsWithWork({
      userId,
      campaignName: decodeURIComponent(campaignName),
      assignedAt: decodeURIComponent(assignedAt),
      page,
      limit,
      search: search || "",
    });

    return res.status(200).json({
      success: true,
      message: "Assignment leads with work fetched successfully",
      ...result,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "An error occurred while fetching assignment leads with work",
    });
  }
};

export const getUserCampaignsWithWorkSummary = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const userId = req.query.userId
      ? parseInt(req.query.userId as string, 10)
      : undefined;

    if (!userId || isNaN(userId)) {
      return res.status(400).json({
        success: false,
        message: "Valid userId is required",
      });
    }

    const result = await LeadService.getUserCampaignsWithWorkSummary({
      userId,
    });

    return res.status(200).json({
      success: true,
      message: "User campaigns with work summary fetched successfully",
      ...result,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "An error occurred while fetching user campaigns with work summary",
    });
  }
};

export const getLeadsWithWork = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    const isAdmin = canViewAllLeads(req);
    const { isUserManager, getManagerBrandUserIds } = await import("../utils/brandUtils");
    const isManager = await isUserManager(userId);
    const managerBrandUserIds = isManager ? await getManagerBrandUserIds(userId) : [];

    if (!isAdmin && !isManager) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Admin or Manager only feature.",
      });
    }

    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit
      ? parseInt(req.query.limit as string, 10)
      : 10;
    const search = req.query.search ? (req.query.search as string).trim() : "";
    const filterType = req.query.filterType
      ? (req.query.filterType as FilterType)
      : undefined;
    const startDate = req.query.startDate
      ? (req.query.startDate as string)
      : undefined;
    const endDate = req.query.endDate
      ? (req.query.endDate as string)
      : undefined;

    const leads = await LeadService.getLeadsWithWork({
      page,
      limit,
      search,
      filterType,
      startDate,
      endDate,
      brandUserIds: isManager ? managerBrandUserIds : undefined,
    });

    return res.status(200).json({
      success: true,
      message: "Leads with work fetched successfully",
      ...leads,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch leads with work",
    });
  }
};

export const getLeadCreationStats = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const userId = req.query.userId
      ? parseInt(req.query.userId as string)
      : undefined;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    const campaignName = req.query.campaignName as string | undefined;

    const stats = await LeadService.getLeadCreationStats(
      userId,
      startDate,
      endDate,
      campaignName,
    );

    return res.status(200).json(stats);
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch lead creation statistics",
    });
  }
};
