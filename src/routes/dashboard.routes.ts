import express from "express";
import { getDashboardStatsController } from "../controllers/dashboard.controller";
import { verifyToken } from "../middleware/verifyToken.middleware";
import { checkPermission } from "../middleware/checkPermission";
import { PERMISSIONS } from "../constants/permissions";

const router = express.Router();

router.get(
  "/stats",
  verifyToken,
  checkPermission(PERMISSIONS.USER_GET), // Using USER_GET permission for dashboard access
  getDashboardStatsController
);

export default router;

