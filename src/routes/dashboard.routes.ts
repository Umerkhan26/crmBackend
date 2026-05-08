import express from "express";
import { getDashboardStatsController } from "../controllers/dashboard.controller";
import {
  getAdminCallReportController,
  getMyCallReportController,
} from "../controllers/callReport.controller";
import { verifyToken } from "../middleware/verifyToken.middleware";
import { requireAdmin } from "../middleware/requireAdmin.middleware";

const router = express.Router();

// Dashboard stats - accessible to all authenticated users
// The service handles admin vs non-admin logic internally
router.get(
  "/stats",
  verifyToken,
  getDashboardStatsController
);

/** Google Voice–style outbound call summary for the logged-in user */
router.get("/dashboard/calls/report", verifyToken, getMyCallReportController);

/**
 * Admin: outbound call summary. Query `period`: day | week | month | range (default range).
 * day + date | week + weekStart | month + month | range + optional from & to. Optional userId.
 */
router.get(
  "/admin/dashboard/calls/report",
  verifyToken,
  requireAdmin,
  getAdminCallReportController
);

export default router;
