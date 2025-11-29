import { Router } from "express";
import {
  deleteLeadActivityController,
  getActivityLogsByEntity,
  getAllLeadActivityLogs,
  getLeadActivities,
  getLeadActivityReportByUserController,
  updateLeadActivityController,
} from "../controllers/leadActivity.controller";
import { verifyToken } from "../middleware/verifyToken.middleware";

const router = Router();

router.get(
  "/getLeadActivityByLeadId/:leadId",
  verifyToken,
  getLeadActivities);

router.get(
  "/getAllLeadActivities",
  verifyToken,
  getAllLeadActivityLogs);

router.get(
  "/getActivitiesByEntity/:entityType/:entityId",
  verifyToken,
  getActivityLogsByEntity
);
router.put(
  "/updateLeadActivity/:id",
  verifyToken,
  updateLeadActivityController);

router.delete(
  "/deleteLeadActivity/:id",
  verifyToken,
  deleteLeadActivityController);


router.get(
  "/LeadreportByUser",
  getLeadActivityReportByUserController
);

export default router;
