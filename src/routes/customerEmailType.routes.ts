import { Router } from "express";
import { verifyToken } from "../middleware/verifyToken.middleware";
import { checkPermission } from "../middleware/checkPermission";
import { PERMISSIONS } from "../constants/permissions";
import {
  listCustomerEmailTypesAdminController,
  listCustomerEmailFlowOptionsController,
  createCustomerEmailTypeController,
  updateCustomerEmailTypeController,
  deactivateCustomerEmailTypeController,
} from "../controllers/customerEmailType.controller";

const router = Router();
const managePerm = PERMISSIONS.BRAND_UPDATE;

router.use(verifyToken);

router.get("/flow-options", listCustomerEmailFlowOptionsController);

router.get("/", listCustomerEmailTypesAdminController);

router.post("/", checkPermission(managePerm), createCustomerEmailTypeController);

router.patch("/:id", checkPermission(managePerm), updateCustomerEmailTypeController);

router.delete(
  "/:id",
  checkPermission(managePerm),
  deactivateCustomerEmailTypeController
);

export default router;
