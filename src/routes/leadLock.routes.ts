import express from "express";
import { verifyToken } from "../middleware/verifyToken.middleware";
import { checkPermission } from "../middleware/checkPermission";
import { PERMISSIONS } from "../constants/permissions";
import * as LeadLockController from "../controllers/leadLock.controller";

const router = express.Router();

router.use(verifyToken);

router.patch(
  "/lead-locks/:leadId",
  checkPermission(PERMISSIONS.LEAD_LOCK_WRITE),
  LeadLockController.setLeadLockStatusController,
);
router.get(
  "/lead-locks/:leadId",
  checkPermission(PERMISSIONS.LEAD_LOCK_READ),
  LeadLockController.getLeadLockController,
);
router.get(
  "/lead-locks",
  checkPermission(PERMISSIONS.LEAD_LOCK_READ),
  LeadLockController.getLeadLocksController,
);

export default router;
