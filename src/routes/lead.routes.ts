import { Router } from "express";
import * as LeadController from "../controllers/lead.controller";
import { verifyToken } from "../middleware/verifyToken.middleware";
import { checkPermission } from "../middleware/checkPermission";
import { PERMISSIONS } from "../constants/permissions";
import multer from "multer";
import { importLeads } from "../controllers/importLead.controller";

const router = Router();

/** ----------------------------
 *  FIX: UPDATED MULTER CONFIG
 * ----------------------------
 */
const storage = multer.memoryStorage();

export const upload = multer({
  storage,
  limits: {
    fileSize: 20 * 1024 * 1024,  // allow up to 20MB file
    fieldSize: 10 * 1024 * 1024, // allow up to 10MB text fields
  },
});

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

router.get("/getleadByid/:id", verifyToken, LeadController.getLeadById);

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

router.post(
  "/assign/:leadId",
  verifyToken,
  LeadController.assignUserToLead
);

// Get assigned users to a lead
router.get(
  "/getLeadsWithAssignee",
  verifyToken,
  LeadController.getAllLeadsWithAssignee
);

// Get assignment stats
router.get(
  "/assignment-stats",
  verifyToken,
  LeadController.getAssignmentStats
);

// Get all unassigned users for a lead
router.get(
  "/getLeadsWithUnassigned",
  verifyToken,
  LeadController.getUnassignedLeads
);

router.get(
  "/getLeadsByAssigneeId/:assigneeId",
  verifyToken,
  checkPermission(PERMISSIONS.ASSIGNED_LEAD_GET_BY_ASSIGNEE),
  LeadController.getLeadsByAssigneeId
);

router.post(
  "/leads/:leadId/send-email",
  verifyToken,
  LeadController.sendEmailToLead
);

router.get(
  "/status-summary",
  verifyToken,
  checkPermission(PERMISSIONS.ASSIGNED_LEAD_GET_STATUS_SUMMARY),
  LeadController.getLeadStatusSummary
);

router.put(
  "/getAssignedLeadsByStatus/:leadId/status",
  verifyToken,
  checkPermission(PERMISSIONS.ASSIGNED_LEAD_UPDATE_STATUS),
  LeadController.updateLeadStatus
);

router.get(
  "/lead-get-by-campaign-and-assignee/:campaignName",
  verifyToken,
  checkPermission(PERMISSIONS.ASSIGNED_LEAD_GET_BY_CAMPAIGN_AND_ASSIGNEE),
  LeadController.getLeadsByCampaignAndAssignee
);

/** ------------------------------------------
 *  FIXED IMPORT ROUTE (NO OTHER CHANGE)
 * ------------------------------------------ */
router.post(
  "/import-leads",
  verifyToken,
  upload.single("file"),
  importLeads
);

export default router;
