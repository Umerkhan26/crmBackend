import express from "express";
import { verifyToken } from "../middleware/verifyToken.middleware";
import { checkPermission } from "../middleware/checkPermission";
import { PERMISSIONS } from "../constants/permissions";
import * as LeadLockController from "../controllers/leadLock.controller";

const router = express.Router();

router.use(verifyToken);

router.post(
  "/lead-locks/:leadId/lock",
  checkPermission(PERMISSIONS.LEAD_UPDATE),
  LeadLockController.lockLeadController,
);
router.patch(
  "/lead-locks/:leadId/unlock",
  checkPermission(PERMISSIONS.LEAD_UPDATE),
  LeadLockController.unlockLeadController,
);
router.get(
  "/lead-locks/:leadId",
  checkPermission(PERMISSIONS.LEAD_GET_ALL),
  LeadLockController.getLeadLockController,
);
router.get(
  "/lead-locks",
  checkPermission(PERMISSIONS.LEAD_GET_ALL),
  LeadLockController.getLeadLocksController,
);

export default router;
