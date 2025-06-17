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
export const getAllLeads = async (req: Request, res: Response): Promise<any> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    const leads = await LeadService.getAllLeads({ page, limit });

    return res.status(200).json({
      message: "Leads fetched successfully",
      ...leads, // includes totalItems, data, totalPages, currentPage
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

// Get Leads by Campaign
export const getLeadsByCampaign = async (req: Request, res: Response): Promise<any> => {
  try {
    const { campaignName } = req.params;
    const leads = await LeadService.getLeadsByCampaign(campaignName);

    if (leads.length === 0) {
      return res.status(404).json({ message: "No leads found for this campaign" });
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
    return res.status(200).json({ message: "Lead updated successfully", lead: updatedLead });
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
