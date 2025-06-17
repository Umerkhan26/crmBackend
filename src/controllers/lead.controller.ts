import { Request, Response } from "express";
import * as LeadService from "../services/lead.service";
import { CustomRequest } from "../types/custom"; // assuming this has req.user?.id

// Create Lead
export const createLead = async (req: CustomRequest, res: Response): Promise<any> => {
  try {
    const { campaignName, leadData } = req.body;
    const userId = req.user?.id;

    if (!campaignName || !leadData || typeof leadData !== "object") {
      return res.status(400).json({ message: "Invalid lead data." });
    }

    const lead = await LeadService.createLead({ campaignName, leadData }, userId);
    return res.status(201).json({ message: "Lead created successfully", lead });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

// Update Lead
export const updateLead = async (req: CustomRequest, res: Response): Promise<any> => {
  try {
    const leadId = parseInt(req.params.id, 10);
    const updatedData = req.body;
    const userId = req.user?.id;

    if (isNaN(leadId)) {
      return res.status(400).json({ message: "Invalid lead ID" });
    }

    const updatedLead = await LeadService.updateLead(leadId, updatedData, userId);
    return res.status(200).json({ message: "Lead updated successfully", lead: updatedLead });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

// Delete Lead
export const deleteLead = async (req: CustomRequest, res: Response): Promise<any> => {
  try {
    const leadId = parseInt(req.params.id, 10);
    const userId = req.user?.id;

    if (isNaN(leadId)) {
      return res.status(400).json({ message: "Invalid lead ID" });
    }

    await LeadService.deleteLead(leadId, userId);
    return res.status(200).json({ message: "Lead deleted successfully" });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};
