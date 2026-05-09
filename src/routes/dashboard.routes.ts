import express from "express";
import { getDashboardStatsController } from "../controllers/dashboard.controller";
import {
  getAdminCallReportByUserController,
  getAdminCallReportCallsController,
  getAdminCallReportController,
  getMyCallReportCallsController,
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

/** User outbound call summary: optional `period=today|yesterday` (UTC), else `from` / `to` (default last 60 days) */
router.get("/dashboard/calls/report", verifyToken, getMyCallReportController);

/** Paginated user calls: same `period` / `from` / `to` as report + `page` / `limit` */
router.get(
  "/dashboard/calls/report/calls",
  verifyToken,
  getMyCallReportCallsController
);

/**
 * Admin: outbound call summary. `period`: day | week | month | range | today | yesterday (default range).
 * Optional userId.
 */
router.get(
  "/admin/dashboard/calls/report",
  verifyToken,
  requireAdmin,
  getAdminCallReportController
);

/** Admin: paginated per-user summaries (`page`, `limit` + same `period` / date params as aggregate). */
router.get(
  "/admin/dashboard/calls/report/by-user",
  verifyToken,
  requireAdmin,
  getAdminCallReportByUserController
);

/** Admin: paginated call rows (`page`, `limit`, optional `userId` + same period params). */
router.get(
  "/admin/dashboard/calls/report/calls",
  verifyToken,
  requireAdmin,
  getAdminCallReportCallsController
);

export default router;
