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


router.post(
  "/assign/:leadId",
  verifyToken,
  checkPermission(PERMISSIONS.LEAD_ASSIGN_USER),
  LeadController.assignUserToLead
);
router.post(
  "/assign/:leadId",
  verifyToken,
  checkPermission(PERMISSIONS.LEAD_ASSIGN_USER),
  LeadController.assignUserToLead
);

// ✅ Get assigned users to a lead
router.get(
  "/getLeadsWithAssignee",
  verifyToken,
  checkPermission(PERMISSIONS.LEAD_VIEW_ASSIGNED_USERS),
  LeadController.getAllLeadsWithAssignee
);

// ✅ Get assignment stats (assigned & unassigned counts)


router.get(
  "/assignment-stats",
  verifyToken,
  checkPermission(PERMISSIONS.LEAD_VIEW_ASSIGNMENT_STATS),
  LeadController.getAssignmentStats
);


// ✅ Get all unassigned users for a lead
router.get(
  "/getLeadsWithUnassigned",
  verifyToken,
  checkPermission(PERMISSIONS.LEAD_VIEW_UNASSIGNED_USERS),
  LeadController.getUnassignedLeads
);
router.get(
  "/getLeadsByAssigneeId/:assigneeId",
  verifyToken,
  checkPermission(PERMISSIONS.LEAD_GET_BY_ASSIGNEE),
  LeadController.getLeadsByAssigneeId
);


router.post("/leads/:leadId/send-email", verifyToken, LeadController.sendEmailToLead);

router.get(
  "/status-summary",
  verifyToken,
  checkPermission(PERMISSIONS.LEAD_GET_STATUS_SUMMARY),
  LeadController.getLeadStatusSummary
);

// ✅ NEW: Update lead status for specific user
router.put(
  "/getAssignedLeadsByStatus:leadId/status",
  verifyToken,
  checkPermission(PERMISSIONS.LEAD_UPDATE_STATUS),
  LeadController.updateLeadStatus
);


router.get(
  "/lead-get-by-campaign-and-assignee/:campaignName",
  verifyToken,
  checkPermission(PERMISSIONS.LEAD_GET_BY_CAMPAIGN_AND_ASSIGNEE),
  LeadController.getLeadsByCampaignAndAssignee
);
export default router;
