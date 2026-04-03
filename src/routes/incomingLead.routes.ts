import express from "express";
import { verifyToken } from "../middleware/verifyToken.middleware";
import { checkPermission } from "../middleware/checkPermission";
import { PERMISSIONS } from "../constants/permissions";
import * as IncomingLeadController from "../controllers/incomingLead.controller";

const router = express.Router();

router.use(verifyToken);

router.post(
  "/incoming-leads",
  checkPermission(PERMISSIONS.INCOMING_LEAD_WRITE),
  IncomingLeadController.createIncomingLeadController,
);
router.get(
  "/incoming-leads",
  checkPermission(PERMISSIONS.INCOMING_LEAD_READ),
  IncomingLeadController.getIncomingLeadsController,
);
router.get(
  "/incoming-leads/:id",
  checkPermission(PERMISSIONS.INCOMING_LEAD_READ),
  IncomingLeadController.getIncomingLeadByIdController,
);
router.put(
  "/incoming-leads/:id",
  checkPermission(PERMISSIONS.INCOMING_LEAD_WRITE),
  IncomingLeadController.updateIncomingLeadController,
);
router.delete(
  "/incoming-leads/:id",
  checkPermission(PERMISSIONS.INCOMING_LEAD_WRITE),
  IncomingLeadController.deleteIncomingLeadController,
);

// Validation and promotion
router.post(
  "/incoming-leads/:id/validate",
  checkPermission(PERMISSIONS.INCOMING_LEAD_WRITE),
  IncomingLeadController.validateIncomingLeadController,
);
router.post(
  "/incoming-leads/:id/promote",
  checkPermission(PERMISSIONS.INCOMING_LEAD_PROMOTE),
  IncomingLeadController.promoteIncomingLeadController,
);
router.post(
  "/incoming-leads/promote",
  checkPermission(PERMISSIONS.INCOMING_LEAD_PROMOTE),
  IncomingLeadController.bulkPromoteIncomingLeadsController,
);

export default router;
