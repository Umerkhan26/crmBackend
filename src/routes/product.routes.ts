import { Router } from "express";
import { verifyToken } from "../middleware/verifyToken.middleware";
import { checkPermission } from "../middleware/checkPermission";
import { checkBrandSaleAccess } from "../middleware/checkBrandSaleAccess";
import { PERMISSIONS } from "../constants/permissions";

import {
  convertLeadToSale,
  getAllSales,
  getSaleById,
  updateSale,
  deleteSale,
  createProduct,
  updateProduct,
  deleteProduct,
  getProductById,
  getAllProducts,
  getInvoice,
  getSalesByAssigneeIdController,
  getSalesByLeadCreatorController,
  getSalesSummaryByBrandController,
} from "../controllers/product.controller";

const router = Router();

router.post(
  "/convertLeadToSale",
  verifyToken,
  checkBrandSaleAccess,
  convertLeadToSale,
);

router.get(
  "/getAllSales",
  verifyToken,
  checkPermission(PERMISSIONS.SALE_GET_ALL),
  getAllSales
);

router.get(
  "/getSalesSummaryByBrand",
  verifyToken,
  checkPermission(PERMISSIONS.SALE_GET_ALL),
  getSalesSummaryByBrandController
);

router.get(
  "/getSalesById/:id",
  verifyToken,
  checkPermission(PERMISSIONS.SALE_GET_BY_ID),
  getSaleById
);
router.get(
  "/getSalesByAssigneeId/:id",
  verifyToken,
  checkPermission(PERMISSIONS.SALE_GET_BY_ASSIGNEE),
  getSalesByAssigneeIdController
);
router.get(
  "/getSalesByLeadCreator/:id",
  verifyToken,
  checkPermission(PERMISSIONS.SALE_GET_ALL), // Use SALE_GET_ALL permission since user has this
  getSalesByLeadCreatorController
);
router.put(
  "/updateSalesById/:id",
  verifyToken,
  checkPermission(PERMISSIONS.SALE_UPDATE),
  updateSale
);

router.delete(
  "/deleteSalesById/:id",
  verifyToken,
  checkPermission(PERMISSIONS.SALE_DELETE),
  deleteSale
);


router.post(
  "/createProduct",
  verifyToken,
  checkPermission(PERMISSIONS.PRODUCT_CREATE),
  createProduct
);

router.get("/getAll", verifyToken, checkBrandSaleAccess, getAllProducts);

router.get(
  "/getById/:id",
  verifyToken,
  checkPermission(PERMISSIONS.PRODUCT_GET_BY_ID),
  getProductById
);

router.put(
  "/updateProduct/:id",
  verifyToken,
  checkPermission(PERMISSIONS.PRODUCT_UPDATE),
  updateProduct
);

router.delete(
  "/deleteProduct/:id",
  verifyToken,
  checkPermission(PERMISSIONS.PRODUCT_DELETE),
  deleteProduct
);

router.get(
  "/invoice/:leadId",
  verifyToken,
  // checkPermission(PERMISSIONS.GET_INVOICE),
  getInvoice
);

export default router;
