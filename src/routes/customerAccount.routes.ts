import { Router } from "express";
import { verifyToken } from "../middleware/verifyToken.middleware";
import { checkPermission } from "../middleware/checkPermission";
import { PERMISSIONS } from "../constants/permissions";
import {
  listCustomerAccountsController,
  getCustomerAccountByIdController,
  getCustomerAccountInsightsController,
  sendCustomerEmailController,
  applyCustomerDiscountController,
  createCustomerUpsellController,
  sendCustomerNotificationController,
  provisionCustomerFromSaleController,
} from "../controllers/customerAccount.controller";

const router = Router();

router.use(verifyToken);

router.get(
  "/",
  checkPermission(PERMISSIONS.CUSTOMER_ACCOUNT_GET),
  listCustomerAccountsController
);

router.get(
  "/:id/insights",
  checkPermission(PERMISSIONS.CUSTOMER_ACCOUNT_GET),
  getCustomerAccountInsightsController
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

router.get(
  "/:id",
  checkPermission(PERMISSIONS.CUSTOMER_ACCOUNT_GET),
  getCustomerAccountByIdController
);

router.post(
  "/provision-from-sale/:saleId",
  checkPermission(PERMISSIONS.CUSTOMER_ACCOUNT_CREATE),
  provisionCustomerFromSaleController
);

export default router;
