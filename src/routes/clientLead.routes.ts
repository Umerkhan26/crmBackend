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

router.post(
  "/createClientLead",
  verifyToken,
  checkPermission(PERMISSIONS.CLIENT_LEAD_CREATE),
  createClientLeadController
);
router.get(
  "/getAllClientLeads",
  verifyToken,
  checkPermission(PERMISSIONS.CLIENT_LEAD_GET_ALL),
  getAllClientLeadsController
);
router.get(
  "/getClientOrder/:orderId",
  verifyToken,
  checkPermission(PERMISSIONS.CLIENT_LEAD_GET_BY_ORDER),
  getClientLeadsByOrder
);
router.get(
  "/getClientLeadById/:id",
  verifyToken,
  checkPermission(PERMISSIONS.CLIENT_LEAD_GET_BY_ID),
  getClientLead
);
router.put(
  "/updateClientLead/:id",
  verifyToken,
  checkPermission(PERMISSIONS.CLIENT_LEAD_UPDATE),
  updateClientLead
);
router.delete(
  "/deleteClientLead/:id",
  verifyToken,
  checkPermission(PERMISSIONS.CLIENT_LEAD_DELETE),
  deleteClientLead
);
router.patch(
  "/updateLeadStatus/:id",
  verifyToken,
  checkPermission(PERMISSIONS.CLIENT_LEAD_UPDATE_STATUS),
  updateClientLeadStatusController
);
router.get(
  "/getClientLeadActivities/:id",
  verifyToken,
  getClientLeadActivitiesController
);
router.post(
  "/sendEmailToClientLead/:clientLeadId",
  verifyToken,
  sendEmailToClientLeadController
);
export default router;
