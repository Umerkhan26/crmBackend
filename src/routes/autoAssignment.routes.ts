import express from "express";
import { verifyToken } from "../middleware/verifyToken.middleware";
import { checkPermission } from "../middleware/checkPermission";
import { PERMISSIONS } from "../constants/permissions";
import {
  assignByDateToTeamAController,
  rebalanceTeamController,
  rotateByTenureController,
  runManualAutoAssignmentController,
} from "../controllers/autoAssignment.controller";
import {
  getAutoAssignmentSettingsController,
  updateAutoAssignmentSettingsController,
} from "../controllers/autoAssignmentSettings.controller";

const router = express.Router();

router.use(verifyToken);

router.get(
  "/auto-assignment/settings",
  checkPermission(PERMISSIONS.AUTO_ASSIGNMENT_SETTINGS_READ),
  getAutoAssignmentSettingsController,
);
router.patch(
  "/auto-assignment/settings",
  checkPermission(PERMISSIONS.AUTO_ASSIGNMENT_SETTINGS_WRITE),
  updateAutoAssignmentSettingsController,
);

// Manual run: promote pending incoming_leads (runId) → assign to Team A → rotate → rebalance
router.post(
  "/auto-assignment/run",
  checkPermission(PERMISSIONS.LEAD_ASSIGNMENT_BATCH_WRITE),
  runManualAutoAssignmentController,
);

// Assign by date window (yesterday/today/custom) to Team A
router.post(
  "/auto-assignment/assign-by-date",
  checkPermission(PERMISSIONS.LEAD_ASSIGNMENT_BATCH_WRITE),
  assignByDateToTeamAController,
);

// Rebalance a single team manually
router.post(
  "/auto-assignment/rebalance-team/:teamId",
  checkPermission(PERMISSIONS.LEAD_ASSIGNMENT_BATCH_WRITE),
  rebalanceTeamController,
);

// Rotate eligible leads by tenure (hours)
router.post(
  "/auto-assignment/rotate",
  checkPermission(PERMISSIONS.LEAD_ASSIGNMENT_BATCH_WRITE),
  rotateByTenureController,
);

export default router;
