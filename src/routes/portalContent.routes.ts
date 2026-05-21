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

router.get(
  "/brands",
  checkPermission(PERMISSIONS.PORTAL_CONTENT_GET),
  listPortalBrandsController
);

router.get(
  "/announcements",
  checkPermission(PERMISSIONS.PORTAL_CONTENT_GET),
  listAnnouncementsController
);
router.post(
  "/announcements",
  checkPermission(PERMISSIONS.PORTAL_CONTENT_CREATE),
  createAnnouncementController
);
router.patch(
  "/announcements/:id",
  checkPermission(PERMISSIONS.PORTAL_CONTENT_UPDATE),
  updateAnnouncementController
);
router.delete(
  "/announcements/:id",
  checkPermission(PERMISSIONS.PORTAL_CONTENT_DELETE),
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
