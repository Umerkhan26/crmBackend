import { Request, Response } from "express";
import * as LeadService from "../services/lead.service";

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

// Get All Leads
// export const getAllLeads = async (req: Request, res: Response): Promise<any> => {
//   try {
//     const page = parseInt(req.query.page as string) || 1;
//     const limit = parseInt(req.query.limit as string) || 10;
//     const search = (req.query.search as string) || ""; // Ensure default empty string

//     // Collect filters (extendable for more keys)
//     const filters: any = {};
//     if (req.query.status) filters.status = req.query.status;
//     if (req.query.campaign_id) filters.campaign_id = Number(req.query.campaign_id);

//     const leads = await LeadService.getAllLeads({
//       page,
//       limit,
//       search,
//       filters,
//     });

//     return res.status(200).json({
//       success: true,
//       message: "Leads fetched successfully",
//       ...leads,
//     });
//   } catch (error: any) {
//     console.error("Error in getAllLeads:", error);
//     return res.status(500).json({
//       success: false,
//       message: error.message || "An error occurred while fetching leads",
//     });
//   }
// };


export const getAllLeads = async (req: Request, res: Response): Promise<any> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = (req.query.search as string) || "";

    // Prepare filters based on query parameters
    const filters: any = {};
    if (req.query.status) filters.status = req.query.status;
    if (req.query.campaign_id) filters.campaign_id = Number(req.query.campaign_id);

    // Call service with the structured parameters
    const leadsData = await LeadService.getAllLeads({
      page,
      limit,
      search,
      filters,
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
export const assignUserToLead = async (req: Request, res: Response): Promise<any> => {
  try {
    const leadId = parseInt(req.params.leadId, 10);
    const userId = parseInt(req.body.userId, 10);
    const assignedByUserId = req.user?.id; // assuming user info is set by verifyToken middleware

    if (isNaN(leadId) || isNaN(userId)) {
      return res.status(400).json({ message: "Invalid lead ID or user ID." });
    }

    const updatedLead = await LeadService.assignLeadToUser(leadId, userId, assignedByUserId);

    return res.status(200).json({
      success: true,
      message: `User ID ${userId} has been assigned to lead ID ${leadId}.`,
      lead: updatedLead,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || "An error occurred while assigning user to lead.",
    });
  }
};

export const getAllLeadsWithAssignee = async (req: Request, res: Response) => {
  try {
    const leads = await LeadService.getAllLeadsWithAssignee();
    res.status(200).json({ success: true, data: leads });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getLeadsByAssigneeId = async (req: Request, res: Response): Promise<any> => {
  try {
    const assigneeId = parseInt(req.params.assigneeId, 10);

    if (isNaN(assigneeId)) {
      return res.status(400).json({ message: "Invalid assignee ID." });
    }

    const leads = await LeadService.getLeadsByAssigneeId(assigneeId);

    return res.status(200).json({
      success: true,
      message: `Leads assigned to user ID ${assigneeId} fetched successfully.`,
      data: leads,
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

export const getUnassignedLeads = async (req: Request, res: Response) => {
  try {
    const leads = await LeadService.getUnassignedLeads();
    res.status(200).json({ success: true, data: leads });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};