import { Router } from "express";
import {
  createClientLeadController,
  getClientLeadsByOrder,
  getClientLead,
  getAllClientLeadsController,
  updateClientLead,
  deleteClientLead,
  updateClientLeadStatusController,
  getClientLeadActivitiesController,
  sendEmailToClientLeadController,
} from "../controllers/clientLead.controller";
import { verifyToken } from "../middleware/verifyToken.middleware";
import { checkPermission } from "../middleware/checkPermission";
import { PERMISSIONS } from "../constants/permissions";

const router = Router();

// Create a new client lead
router.post(
  "/createClientLead",
  verifyToken,
  checkPermission(PERMISSIONS.CLIENT_LEAD_CREATE),
  createClientLeadController
);

// Get all client leads
router.get(
  "/getAllClientLeads",
  verifyToken,
  checkPermission(PERMISSIONS.CLIENT_LEAD_GET_ALL),
  getAllClientLeadsController
);

// Get client leads by order ID
router.get(
  "/getClientOrder/:orderId",
  verifyToken,
  checkPermission(PERMISSIONS.CLIENT_LEAD_GET_BY_ORDER),
  getClientLeadsByOrder
);

// Get a single client lead by ID
router.get(
  "/getClientLeadById/:id",
  verifyToken,
  checkPermission(PERMISSIONS.CLIENT_LEAD_GET_BY_ID),
  getClientLead
);

// Update client lead by ID
router.put(
  "/updateClientLead/:id",
  verifyToken,
  checkPermission(PERMISSIONS.CLIENT_LEAD_UPDATE),
  updateClientLead
);

// Delete client lead by ID
router.delete(
  "/deleteClientLead/:id",
  verifyToken,
  checkPermission(PERMISSIONS.CLIENT_LEAD_DELETE),
  deleteClientLead
);

router.patch(
  "/updateLeadStatus/:id",
  verifyToken,
  checkPermission(PERMISSIONS.CLIENT_LEAD_UPDATE_STATUS), // or define a new permission if needed
  updateClientLeadStatusController
);


router.get(
  "/getClientLeadActivities/:id",
  verifyToken,
  // checkPermission(PERMISSIONS.CLIENT_LEAD_GET_ACTIVITIES),
  getClientLeadActivitiesController
);


router.post(
  "/sendEmailToClientLead/:clientLeadId",
  verifyToken,
  sendEmailToClientLeadController
);
export default router;
