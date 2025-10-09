// src/routes/leadActivity.routes.ts

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

// GET /api/lead-activities/:leadId
router.get("/getLeadActivityByLeadId/:leadId", verifyToken, getLeadActivities);

router.get("/getAllLeadActivities", verifyToken, getAllLeadActivityLogs);

router.get(
  "/getActivitiesByEntity/:entityType/:entityId",
  verifyToken,
  getActivityLogsByEntity
);
// UPDATE lead activity
router.put("/updateLeadActivity/:id", verifyToken, updateLeadActivityController);

// DELETE lead activity
router.delete("/deleteLeadActivity/:id", verifyToken, deleteLeadActivityController);


router.get("/LeadreportByUser", getLeadActivityReportByUserController
);

export default router;
