import express from "express";
import { verifyToken } from "../middleware/verifyToken.middleware";
import { checkPermission } from "../middleware/checkPermission";
import { PERMISSIONS } from "../constants/permissions";
import * as LeadAssignmentBatchController from "../controllers/leadAssignmentBatch.controller";

const router = express.Router();

router.use(verifyToken);

router.post(
  "/lead-assignment-batches",
  checkPermission(PERMISSIONS.LEAD_UPDATE),
  LeadAssignmentBatchController.createLeadAssignmentBatchController,
);
router.get(
  "/lead-assignment-batches",
  checkPermission(PERMISSIONS.LEAD_GET_ALL),
  LeadAssignmentBatchController.getLeadAssignmentBatchesController,
);
router.get(
  "/lead-assignment-batches/:id",
  checkPermission(PERMISSIONS.LEAD_GET_ALL),
  LeadAssignmentBatchController.getLeadAssignmentBatchByIdController,
);
router.patch(
  "/lead-assignment-batches/:id",
  checkPermission(PERMISSIONS.LEAD_UPDATE),
  LeadAssignmentBatchController.updateLeadAssignmentBatchController,
);

export default router;
