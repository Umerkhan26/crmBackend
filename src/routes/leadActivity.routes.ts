// src/routes/leadActivity.routes.ts

import { Router } from "express";
import {
  deleteLeadActivityController,
  getAllLeadActivityLogs,
  getLeadActivities,
  updateLeadActivityController,
} from "../controllers/leadActivity.controller";
import { verifyToken } from "../middleware/verifyToken.middleware";

const router = Router();

// GET /api/lead-activities/:leadId
router.get("/getLeadActivityByLeadId/:leadId", verifyToken, getLeadActivities);

router.get("/getAllLeadActivities", verifyToken, getAllLeadActivityLogs);

// UPDATE lead activity
router.put("/updateLeadActivity/:id", verifyToken, updateLeadActivityController);

// DELETE lead activity
router.delete("/deleteLeadActivity/:id", verifyToken, deleteLeadActivityController);

export default router;
