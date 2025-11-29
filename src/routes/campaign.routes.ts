import { Router } from "express";
import {
  createCampaignn,
  getAllCampaigns,
  getCampaignById,
  updateCampaign,
  deleteCampaign,
} from "../controllers/campaign.controller";
import express from "express";
import { verifyToken } from "../middleware/verifyToken.middleware";
import { checkPermission } from "../middleware/checkPermission";
import { PERMISSIONS } from "../constants/permissions";
import { checkCampaignPermission } from "../middleware/checkCampaignPermission";

const router = express.Router();
router.post(
  "/createCampaign",
  verifyToken,
  checkPermission(PERMISSIONS.CAMPAIGN_CREATE),
  createCampaignn
);
router.get(
  "/getAllCampaigns",
  verifyToken,
  checkPermission(PERMISSIONS.CAMPAIGN_GET),
  getAllCampaigns
);
router.get(
  "/getCampaignById/:id",
  verifyToken,
  checkCampaignPermission("get"),
  getCampaignById
);
router.get(
  "/getCampaignId/:id",
  verifyToken,
  checkPermission(PERMISSIONS.CAMPAIGN_GET),
  getCampaignById
);
router.put(
  "/updateCampaignById/:id",
  verifyToken,
  checkPermission(PERMISSIONS.CAMPAIGN_UPDATE),
  updateCampaign
);
router.delete(
  "/deleteCampaign/:id",
  verifyToken,
  checkPermission(PERMISSIONS.CAMPAIGN_DELETE),
  deleteCampaign
);
export default router;
