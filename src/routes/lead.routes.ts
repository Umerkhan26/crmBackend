import { Router } from "express";
import * as LeadController from "../controllers/lead.controller";
import { verifyToken } from "../middleware/verifyToken.middleware";
import { checkPermission } from "../middleware/checkPermission";
import { PERMISSIONS } from "../constants/permissions";

const router = Router();

// Create Lead
router.post(
  "/leads",
  verifyToken,
  checkPermission(PERMISSIONS.LEAD_CREATE),
  LeadController.createLead
);

// Get All Leads
router.get(
  "/getleads",
  verifyToken,
  checkPermission(PERMISSIONS.LEAD_GET_ALL),
  LeadController.getAllLeads
);

// Get Leads by Campaign
router.get(
  "/leads/campaign/:campaignName",
  verifyToken,
  checkPermission(PERMISSIONS.LEAD_GET_BY_CAMPAIGN),
  LeadController.getLeadsByCampaign
);

// Update Lead
router.put(
  "/leads/:id",
  verifyToken,
  checkPermission(PERMISSIONS.LEAD_UPDATE),
  LeadController.updateLead
);

// Delete Lead
router.delete(
  "/leads/:id",
  verifyToken,
  checkPermission(PERMISSIONS.LEAD_DELETE),
  LeadController.deleteLead
);

export default router;
