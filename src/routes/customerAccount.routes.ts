import { Router } from "express";
import { verifyToken } from "../middleware/verifyToken.middleware";
import { checkPermission } from "../middleware/checkPermission";
import { checkCustomerAccountReadAccess } from "../middleware/checkCustomerAccountReadAccess";
import { PERMISSIONS } from "../constants/permissions";
import {
  listCustomerAccountsController,
  getCustomerAccountByIdController,
  getCustomerAccountInsightsController,
  getCustomerPortalActivityController,
  getCustomerEngagementsFeedController,
  getCustomerTimelineFeedController,
  updateCustomerAccountController,
  deleteCustomerAccountController,
  sendCustomerEmailController,
  applyCustomerDiscountController,
  createCustomerUpsellController,
  sendCustomerNotificationController,
  provisionCustomerFromSaleController,
} from "../controllers/customerAccount.controller";
import {
  createBulkCustomerEmailController,
  listBulkCustomerEmailCampaignsController,
  getBulkCustomerEmailStatusController,
  cancelBulkCustomerEmailController,
  listBulkCustomerEmailFailuresController,
} from "../controllers/bulkCustomerEmail.controller";

const router = Router();

router.use(verifyToken);

router.get("/", checkCustomerAccountReadAccess, listCustomerAccountsController);

router.post(
  "/bulk-email",
  checkPermission(PERMISSIONS.CUSTOMER_ACCOUNT_CREATE),
  createBulkCustomerEmailController
);

router.get(
  "/bulk-email",
  checkPermission(PERMISSIONS.CUSTOMER_ACCOUNT_CREATE),
  listBulkCustomerEmailCampaignsController
);

router.get(
  "/bulk-email/:campaignId/failures",
  checkPermission(PERMISSIONS.CUSTOMER_ACCOUNT_CREATE),
  listBulkCustomerEmailFailuresController
);

router.post(
  "/bulk-email/:campaignId/cancel",
  checkPermission(PERMISSIONS.CUSTOMER_ACCOUNT_CREATE),
  cancelBulkCustomerEmailController
);

router.get(
  "/bulk-email/:campaignId",
  checkPermission(PERMISSIONS.CUSTOMER_ACCOUNT_CREATE),
  getBulkCustomerEmailStatusController
);

router.post(
  "/provision-from-sale/:saleId",
  checkPermission(PERMISSIONS.CUSTOMER_ACCOUNT_CREATE),
  provisionCustomerFromSaleController
);

router.get(
  "/:id/insights",
  checkCustomerAccountReadAccess,
  getCustomerAccountInsightsController,
);

router.get(
  "/:id/portal-activity",
  checkCustomerAccountReadAccess,
  getCustomerPortalActivityController,
);

router.get(
  "/:id/engagements",
  checkCustomerAccountReadAccess,
  getCustomerEngagementsFeedController,
);

router.get(
  "/:id/timeline",
  checkCustomerAccountReadAccess,
  getCustomerTimelineFeedController,
);

router.post(
  "/:id/send-email",
  checkPermission(PERMISSIONS.CUSTOMER_ACCOUNT_CREATE),
  sendCustomerEmailController
);

router.post(
  "/:id/upsell",
  checkPermission(PERMISSIONS.CUSTOMER_ACCOUNT_CREATE),
  createCustomerUpsellController
);

router.post(
  "/:id/discount",
  checkPermission(PERMISSIONS.CUSTOMER_ACCOUNT_CREATE),
  applyCustomerDiscountController
);

router.post(
  "/:id/notify",
  checkPermission(PERMISSIONS.CUSTOMER_ACCOUNT_CREATE),
  sendCustomerNotificationController
);

router.patch(
  "/:id",
  checkPermission(PERMISSIONS.CUSTOMER_ACCOUNT_UPDATE),
  updateCustomerAccountController
);

router.delete(
  "/:id",
  checkPermission(PERMISSIONS.CUSTOMER_ACCOUNT_DELETE),
  deleteCustomerAccountController
);

router.get("/:id", checkCustomerAccountReadAccess, getCustomerAccountByIdController);

export default router;
