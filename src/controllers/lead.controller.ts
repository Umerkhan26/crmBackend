import { Request, Response } from "express";
import * as LeadService from "../services/lead.service";
import { LeadStatus } from "../models/lead.model";
import { FilterType } from "../utils/dateFilters";
import { getPagingData } from "../utils/paginate";

// Create Lead
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

export const getAllLeads = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = (req.query.search as string) || "";

    // ⏳ Date filter handling
    const filterType = req.query.filterType as FilterType;
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;

    // Other filters
    const filters: any = {};
    if (req.query.status) filters.status = req.query.status;
    if (req.query.campaign_id)
      filters.campaign_id = Number(req.query.campaign_id);

    // Call the service
    const leadsData = await LeadService.getAllLeads({
      page,
      limit,
      search,
      filters,
      filterType,
      startDate,
      endDate,
    });

    return res.status(200).json({
      success: true,
      message: "Leads fetched successfully",
      ...leadsData,
    });
  } catch (error: any) {
    console.error("Error in getAllLeads:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "An error occurred while fetching leads",
    });
  }
};

// Get Leads by Campaign
export const getLeadsByCampaign = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const { campaignName } = req.params;
    const leads = await LeadService.getLeadsByCampaign(campaignName);

    if (leads.length === 0) {
      return res
        .status(404)
        .json({ message: "No leads found for this campaign" });
    }

    return res.status(200).json(leads);
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

// Update Lead
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

// Delete Lead
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
    const assignedByUserId = req.user?.id; // from verifyToken middleware

    let userIds: number[] = [];

    // Multiple IDs case
    if (Array.isArray(req.body.userIds)) {
      userIds = req.body.userIds
        .map((id: string | number) => parseInt(id as string, 10))
        .filter((id: number) => !isNaN(id));
    }
    // Single ID case
    else if (req.body.userId) {
      const singleId = parseInt(req.body.userId, 10);
      if (!isNaN(singleId)) {
        userIds = [singleId];
      }
    }

    if (isNaN(leadId) || userIds.length === 0) {
      return res.status(400).json({ message: "Invalid lead ID or user IDs." });
    }

    // Bulk assign in one DB update
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

// export const getAllLeadsWithAssignee = async (req: Request, res: Response) => {
//   try {
//     const leads = await LeadService.getAllLeadsWithAssignee();
//     res.status(200).json({ success: true, data: leads });
//   } catch (error: any) {
//     res.status(500).json({ success: false, message: error.message });
//   }
// };



export const getAllLeadsWithAssignee = async (req: Request, res: Response):Promise<any> => {
  try {
    const leads = await LeadService.getAllLeadsWithAssignee();

    if (!leads || leads.length === 0) {
      return res.status(404).json({ success: false, message: "No leads found" });
    }

    res.status(200).json({ success: true, data: leads });
  } catch (error: any) {
    console.error("Error in getAllLeadsWithAssignee controller:", error);
    res.status(500).json({ success: false, message: error.message });
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
    if (isNaN(assigneeId)) {
      return res.status(400).json({ message: "Invalid assignee ID." });
    }
    const leadsResult = await LeadService.getLeadsByAssigneeId(
      assigneeId,
      filterType,
      startDate,
      endDate,
      page,
      limit
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

// export const getUnassignedLeads = async (req: Request, res: Response) => {
//   try {
//     const leads = await LeadService.getUnassignedLeads();
//     res.status(200).json({ success: true, data: leads });
//   } catch (error: any) {
//     res.status(500).json({ success: false, message: error.message });
//   }
// };




export const getUnassignedLeads = async (req: Request, res: Response):Promise<any> => {
  try {
    const leads = await LeadService.getUnassignedLeads();

    if (!leads || leads.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "No unassigned leads found" });
    }

    res.status(200).json({ success: true, data: leads });
  } catch (error: any) {
    console.error("Error in getUnassignedLeads controller:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /leads/:leadId/send-email
export const sendEmailToLead = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const leadId = parseInt(req.params.leadId, 10);
    const templateKey = req.body.templateKey; // e.g., "user:create"
    const senderUserId = req.user?.id; // assumes `verifyToken` middleware sets req.user

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
    console.error("Error sending email:", error.message);
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
// export const updateLeadStatus = async (
//   req: Request,
//   res: Response
// ): Promise<any> => {
//   try {
//     const leadId = Number(req.params.leadId);
//     const userId = Number(req.body.userId);
//     const status = req.body.status as LeadStatus;

//     console.log("📌 Update Lead Status Request:", { leadId, userId, status });

//     // ✅ Validate input
//     if (!leadId || !userId || !status) {
//       return res.status(400).json({
//         success: false,
//         message: "Lead ID, user ID, and status are required",
//       });
//     }

//     // ✅ Call service function
//     const updatedLead = await LeadService.updateLeadStatusForUser(
//       leadId,
//       userId,
//       status
//     );

//     return res.status(200).json({
//       success: true,
//       message: `Status updated to "${status}" for user ${userId} on lead ${leadId}`,
//       lead: updatedLead,
//     });
//   } catch (error: any) {
//     console.error("🔥 Error in updateLeadStatus controller:", {
//       message: error.message,
//       stack: error.stack,
//     });

//     return res.status(500).json({
//       success: false,
//       message: error.message || "An error occurred while updating lead status",
//     });
//   }
// };
const ALLOWED_STATUSES: LeadStatus[] = [
  "pending",
  "sold",
  "most_interested",
  "to_call",
];
export const updateLeadStatus = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const leadId = Number(req.params.leadId);
    const userId = Number(req.body.userId);
    const status = req.body.status as LeadStatus;

    console.log("📌 Update Lead Status Request:", { leadId, userId, status });

    // ✅ Validate input existence
    if (!leadId || !userId || !status) {
      return res.status(400).json({
        success: false,
        message: "Lead ID, user ID, and status are required",
      });
    }

    // ✅ Validate status value
    if (!ALLOWED_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Allowed statuses: ${ALLOWED_STATUSES.join(", ")}`,
      });
    }

    // ✅ Call service function
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
    console.error("🔥 Error in updateLeadStatus controller:", {
      message: error.message,
      stack: error.stack,
    });

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
