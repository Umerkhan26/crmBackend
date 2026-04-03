import express from "express";
import { verifyToken } from "../middleware/verifyToken.middleware";
import { checkPermission } from "../middleware/checkPermission";
import { PERMISSIONS } from "../constants/permissions";
import * as AutoAssignmentController from "../controllers/autoAssignment.controller";

const router = express.Router();

router.use(verifyToken);

// Manual run: promote pending incoming_leads (runId) → assign to Team A → rotate → rebalance
router.post(
  "/auto-assignment/run",
  checkPermission(PERMISSIONS.LEAD_ASSIGNMENT_BATCH_WRITE),
  AutoAssignmentController.runManualAutoAssignmentController,
);

// Assign by date window (yesterday/today/custom) to Team A
router.post(
  "/auto-assignment/assign-by-date",
  checkPermission(PERMISSIONS.LEAD_ASSIGNMENT_BATCH_WRITE),
  AutoAssignmentController.assignByDateToTeamAController,
);

// Rebalance a single team manually
router.post(
  "/auto-assignment/rebalance-team/:teamId",
  checkPermission(PERMISSIONS.LEAD_ASSIGNMENT_BATCH_WRITE),
  AutoAssignmentController.rebalanceTeamController,
);

// Rotate eligible leads by tenure (hours)
router.post(
  "/auto-assignment/rotate",
  checkPermission(PERMISSIONS.LEAD_ASSIGNMENT_BATCH_WRITE),
  AutoAssignmentController.rotateByTenureController,
);

export default router;
