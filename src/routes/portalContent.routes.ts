import { Router } from "express";
import { verifyToken } from "../middleware/verifyToken.middleware";
import { checkPermission } from "../middleware/checkPermission";
import { PERMISSIONS } from "../constants/permissions";
import {
  listAnnouncementsController,
  createAnnouncementController,
  updateAnnouncementController,
  deleteAnnouncementController,
  listPopupsController,
  createPopupController,
  updatePopupController,
  deletePopupController,
  setSaleProgressController,
  listPortalBrandsController,
} from "../controllers/portalContent.controller";

const router = Router();

router.use(verifyToken);

const portalContentRead = [
  PERMISSIONS.PORTAL_CONTENT_GET,
  PERMISSIONS.BRAND_GET,
  PERMISSIONS.CUSTOMER_ACCOUNT_GET,
  PERMISSIONS.CUSTOMER_ACCOUNT_CREATE,
];

const portalAnnouncementWrite = [
  PERMISSIONS.PORTAL_CONTENT_CREATE,
  PERMISSIONS.PORTAL_CONTENT_UPDATE,
  PERMISSIONS.CUSTOMER_ACCOUNT_CREATE,
  PERMISSIONS.BRAND_UPDATE,
];

const portalAnnouncementDelete = [
  PERMISSIONS.PORTAL_CONTENT_DELETE,
  PERMISSIONS.CUSTOMER_ACCOUNT_CREATE,
  PERMISSIONS.BRAND_UPDATE,
];

router.get(
  "/brands",
  checkPermission(portalContentRead),
  listPortalBrandsController
);

router.get(
  "/announcements",
  checkPermission(portalContentRead),
  listAnnouncementsController
);
router.post(
  "/announcements",
  checkPermission(portalAnnouncementWrite),
  createAnnouncementController
);
router.patch(
  "/announcements/:id",
  checkPermission(portalAnnouncementWrite),
  updateAnnouncementController
);
router.delete(
  "/announcements/:id",
  checkPermission(portalAnnouncementDelete),
  deleteAnnouncementController
);

router.get(
  "/popups",
  checkPermission(PERMISSIONS.PORTAL_CONTENT_GET),
  listPopupsController
);
router.post(
  "/popups",
  checkPermission(PERMISSIONS.PORTAL_CONTENT_CREATE),
  createPopupController
);
router.patch(
  "/popups/:id",
  checkPermission(PERMISSIONS.PORTAL_CONTENT_UPDATE),
  updatePopupController
);
router.delete(
  "/popups/:id",
  checkPermission(PERMISSIONS.PORTAL_CONTENT_DELETE),
  deletePopupController
);

router.patch(
  "/sales/:saleId/progress",
  checkPermission(PERMISSIONS.PORTAL_CONTENT_UPDATE),
  setSaleProgressController
);

export default router;
