import { Router } from "express";
import * as LeadController from "../controllers/lead.controller";
import { verifyToken } from "../middleware/verifyToken.middleware";
import { checkPermission } from "../middleware/checkPermission";
import { PERMISSIONS } from "../constants/permissions";
import multer from "multer";
import { importLeads } from "../controllers/importLead.controller";

const router = Router();
const storage = multer.memoryStorage(); // store file in memory buffer
export const upload = multer({ storage });
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
router.get("/getleadbyid/:id", verifyToken, LeadController.getLeadById);
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
  // checkPermission(PERMISSIONS.LEAD_ASSIGN_USER),
  LeadController.assignUserToLead
);

// ✅ Get assigned users to a lead
router.get(
  "/getLeadsWithAssignee",
  verifyToken,
  // checkPermission(PERMISSIONS.LEAD_VIEW_ASSIGNED_USERS),
  LeadController.getAllLeadsWithAssignee
);

// ✅ Get assignment stats (assigned & unassigned counts)

router.get(
  "/assignment-stats",
  verifyToken,
  // checkPermission(PERMISSIONS.LEAD_VIEW_ASSIGNMENT_STATS),
  LeadController.getAssignmentStats
);

// ✅ Get all unassigned users for a lead
router.get(
  "/getLeadsWithUnassigned",
  verifyToken,
  // checkPermission(PERMISSIONS.LEAD_VIEW_UNASSIGNED_USERS),
  LeadController.getUnassignedLeads
);
router.get(
  "/getLeadsByAssigneeId/:assigneeId",
  verifyToken,
  // checkPermission(PERMISSIONS.LEAD_GET_BY_ASSIGNEE),
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
  // checkPermission(PERMISSIONS.LEAD_GET_STATUS_SUMMARY),
  checkPermission(PERMISSIONS.ASSIGNED_LEAD_GET_STATUS_SUMMARY),
  LeadController.getLeadStatusSummary
);

// ✅ NEW: Update lead status for specific user
router.put(
  "/getAssignedLeadsByStatus/:leadId/status",
  verifyToken,
  checkPermission(PERMISSIONS.ASSIGNED_LEAD_UPDATE_STATUS),
  LeadController.updateLeadStatus
);

router.get(
  "/lead-get-by-campaign-and-assignee/:campaignName",
  verifyToken,
  // checkPermission(PERMISSIONS.LEAD_GET_BY_CAMPAIGN_AND_ASSIGNEE),
  checkPermission(PERMISSIONS.ASSIGNED_LEAD_GET_BY_CAMPAIGN_AND_ASSIGNEE),
  LeadController.getLeadsByCampaignAndAssignee
);

router.post(
  "/import-leads",
  verifyToken,
  upload.single("file"), // file input field name: 'file'
  importLeads
);
export default router;
