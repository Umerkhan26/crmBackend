import { Router } from "express";
import {
  resolveBrandController,
  brandConfigController,
  customerLoginController,
  customerProfileController,
  customerSalesController,
  customerOrdersController,
  customerOrderProgressController,
  customerInvoicesController,
  customerOffersController,
  customerAnnouncementsController,
  customerPopupsController,
  dismissPopupController,
  customerNotificationsController,
  customerStatsController,
  trackPortalActivityController,
} from "../controllers/customerArea.controller";
import { verifyCustomerToken } from "../middleware/verifyCustomer.middleware";
import {
  attachPortalBrand,
  requirePortalBrand,
} from "../middleware/resolvePortalBrand.middleware";

const router = Router();

// Public — Customer Area portal (subdomain apps + local dev)
router.get("/resolve-brand", attachPortalBrand, resolveBrandController);
router.get("/brand-config", attachPortalBrand, brandConfigController);
router.post("/login", customerLoginController);

// Authenticated — customer JWT (+ brand from token or ?brandSlug / x-customer-host)
router.use(verifyCustomerToken);
router.use(attachPortalBrand);

router.get("/me", customerProfileController);
router.get("/stats", requirePortalBrand, customerStatsController);
router.get("/my-sales", customerSalesController);

router.get("/orders", requirePortalBrand, customerOrdersController);
router.get(
  "/orders/:saleId/progress",
  requirePortalBrand,
  customerOrderProgressController
);
router.get("/invoices", requirePortalBrand, customerInvoicesController);
router.get("/offers", requirePortalBrand, customerOffersController);
router.get(
  "/announcements",
  requirePortalBrand,
  customerAnnouncementsController
);
router.get("/popups", requirePortalBrand, customerPopupsController);
router.post(
  "/popups/:popupId/dismiss",
  requirePortalBrand,
  dismissPopupController
);
router.get(
  "/notifications",
  requirePortalBrand,
  customerNotificationsController
);
router.post("/activity", requirePortalBrand, trackPortalActivityController);

export default router;
