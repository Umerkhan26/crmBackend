import { Router } from "express";
import * as LeadController from "../controllers/lead.controller";
import { verifyToken } from "../middleware/verifyToken.middleware";
import { checkPermission } from "../middleware/checkPermission";
import { PERMISSIONS } from "../constants/permissions";
import multer from "multer";
import { importLeads } from "../controllers/importLead.controller";

const router = Router();

const storage = multer.memoryStorage();
export const upload = multer({
  storage,
  limits: {
    fileSize: 200 * 1024 * 1024,   // 200 MB file
    fieldSize: 50 * 1024 * 1024,   // 50 MB fields
    fields: 2000,                  // max number of text fields
    files: 10,                     // max number of files
    parts: 3000                    // total fields + files
  },
});

router.post(
  "/leads",
  verifyToken,
  checkPermission(PERMISSIONS.LEAD_CREATE),
  LeadController.createLead
);
router.get(
  "/getleads",
  verifyToken,
  checkPermission(PERMISSIONS.LEAD_GET_ALL),
  LeadController.getAllLeads
);
router.get(
  "/admin/new-master-leads",
  verifyToken,
  checkPermission(PERMISSIONS.LEAD_VIEW_ALL),
  LeadController.getAdminMasterLeads,
);
router.get(
  "/getleadByid/:id",
  verifyToken,
  LeadController.getLeadById);
router.get(
  "/admin/new-master-leads/:id",
  verifyToken,
  checkPermission(PERMISSIONS.LEAD_VIEW_ALL),
  LeadController.getUnifiedAdminLeadById,
);
router.get(
  "/leads/campaign/:campaignName",
  verifyToken,
  checkPermission(PERMISSIONS.LEAD_GET_BY_CAMPAIGN),
  LeadController.getLeadsByCampaign
);
router.put(
  "/leads/:id",
  verifyToken,
  checkPermission([
    PERMISSIONS.LEAD_UPDATE, 
    PERMISSIONS.LEAD_GET_ALL,
    PERMISSIONS.ASSIGNED_LEAD_GET_BY_ASSIGNEE,
    PERMISSIONS.ASSIGNED_LEAD_GET_BY_CAMPAIGN_AND_ASSIGNEE
  ]),
  LeadController.updateLead
);
router.delete(
  "/leads/:id",
  verifyToken,
  checkPermission(PERMISSIONS.LEAD_DELETE),
  LeadController.deleteLead
);
router.post(
  "/leads/bulk-delete",
  verifyToken,
  checkPermission(PERMISSIONS.LEAD_DELETE),
  LeadController.bulkDeleteLeads,
);

router.post(
  "/assign/:leadId",
  verifyToken,
  LeadController.assignUserToLead
);

router.post(
  "/bulk-assign",
  verifyToken,
  LeadController.bulkAssignLeadsToUser
);

router.get(
  "/getLeadsWithAssignee",
  verifyToken,
  LeadController.getAllLeadsWithAssignee
);

router.get(
  "/assignment-stats",
  verifyToken,
  LeadController.getAssignmentStats
);

router.get(
  "/admin/lead-campaign-counts",
  verifyToken,
  LeadController.getLeadCampaignCounts,
);
router.post(
  "/admin/lead-campaign-counts",
  verifyToken,
  LeadController.getLeadCampaignCounts,
);

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
  "/hot-leads/manager/requests",
  verifyToken,
  LeadController.getManagerHotLeadRequests,
);

router.put(
  "/hot-leads/manager/requests/:leadId/review",
  verifyToken,
  LeadController.reviewHotLeadRequest,
);

router.get(
  "/hot-leads/my-requests",
  verifyToken,
  checkPermission(PERMISSIONS.ASSIGNED_LEAD_GET_BY_ASSIGNEE),
  LeadController.getMyHotLeadRequests,
);

router.get(
  "/lead-get-by-campaign-and-assignee/:campaignName",
  verifyToken,
  checkPermission(PERMISSIONS.ASSIGNED_LEAD_GET_BY_CAMPAIGN_AND_ASSIGNEE),
  LeadController.getLeadsByCampaignAndAssignee
);

router.post(
  "/import-leads",
  verifyToken,
  upload.single("file"),
  importLeads
);

router.get(
  "/assignment-history",
  verifyToken,
  checkPermission(PERMISSIONS.LEAD_GET_ALL),
  LeadController.getAssignmentHistory
);

router.get(
  "/assignment-leads",
  verifyToken,
  checkPermission(PERMISSIONS.LEAD_GET_ALL),
  LeadController.getAssignmentLeads
);

router.get(
  "/assignment-leads-with-work",
  verifyToken,
  checkPermission(PERMISSIONS.LEAD_GET_ALL),
  LeadController.getAssignmentLeadsWithWork
);

router.get(
  "/user-campaigns-work-summary",
  verifyToken,
  checkPermission(PERMISSIONS.LEAD_GET_ALL),
  LeadController.getUserCampaignsWithWorkSummary
);

router.get(
  "/leads/with-work/filter-users",
  verifyToken,
  LeadController.getLeadsWithWorkFilterUsers
);

router.get(
  "/leads/with-work",
  verifyToken,
  LeadController.getLeadsWithWork
);

router.get(
  "/lead-creation-stats",
  verifyToken,
  checkPermission(PERMISSIONS.LEAD_GET_ALL),
  LeadController.getLeadCreationStats
);

export default router;
