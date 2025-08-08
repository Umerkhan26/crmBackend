// src/routes/leadActivity.routes.ts

import { Router } from "express";
import {
  getAllLeadActivityLogs,
  getLeadActivities,
} from "../controllers/leadActivity.controller";
import { verifyToken } from "../middleware/verifyToken.middleware";

const router = Router();

// GET /api/lead-activities/:leadId
router.get("/getLeadActivityByLeadId/:leadId", verifyToken, getLeadActivities);

router.get("/getAllLeadActivities", verifyToken, getAllLeadActivityLogs);

export default router;
