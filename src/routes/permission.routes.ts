import express from "express";
import * as PermissionController from "../controllers/permission.controller";
import { syncPermissionsToDB } from "../utils/syncPermissions";
import { ensureGetCampaignPermissionsForAllCampaigns } from "../services/campaign.service";

const router = express.Router();

router.get("/getAllPermissions", PermissionController.getAllPermissionsController);

router.get("/getPermissionsById/:id", PermissionController.getPermissionByIdController);

// Route to sync permissions from constants to database (adds missing permissions like call:create, call:get, call:delete)
router.post("/syncPermissions", async (req, res) => {
  try {
    await syncPermissionsToDB();
    const campaignPerms = await ensureGetCampaignPermissionsForAllCampaigns();
    res.status(200).json({
      message: "Permissions synced successfully",
      data: "All permissions from constants have been added to the database",
      campaignPermissions: campaignPerms,
      campaignPermissionsNote:
        "If new getCampaignById rows were created, open Create Role and tick the campaign for each role that should see it (Assigned Leads, dashboard, etc.).",
    });
  } catch (error: any) {
    res.status(500).json({
      message: "Error syncing permissions",
      details: error.message,
    });
  }
});

export default router;
