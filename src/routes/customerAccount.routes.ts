import { Router } from "express";
import { verifyToken } from "../middleware/verifyToken.middleware";
import { checkPermission } from "../middleware/checkPermission";
import { PERMISSIONS } from "../constants/permissions";
import {
  listCustomerAccountsController,
  getCustomerAccountByIdController,
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
