import express from "express";
import { getDashboardStatsController } from "../controllers/dashboard.controller";
import { verifyToken } from "../middleware/verifyToken.middleware";

const router = express.Router();

// Dashboard stats - accessible to all authenticated users
// The service handles admin vs non-admin logic internally
router.get(
  "/stats",
  verifyToken,
  getDashboardStatsController
);

export default router;

