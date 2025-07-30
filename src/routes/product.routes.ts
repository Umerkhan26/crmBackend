import { Router } from "express";
import { verifyToken } from "../middleware/verifyToken.middleware";
import { checkPermission } from "../middleware/checkPermission";
import { PERMISSIONS } from "../constants/permissions";

import {
  convertLeadToSale,
  getAllSales,
  getSaleById,
  updateSale,
  deleteSale,
} from "../controllers/product.controller";

const router = Router();

// ✅ Convert Lead to Sale
router.post(
  "/convertLeadToSale",
  verifyToken,
  checkPermission(PERMISSIONS.PRODUCT_CONVERT_LEAD),
  convertLeadToSale
);

// ✅ Get All Sales
router.get(
  "/getAllSales",
  verifyToken,
  checkPermission(PERMISSIONS.PRODUCT_SALE_GET_ALL),
  getAllSales
);

// ✅ Get Sale by ID
router.get(
  "/getSalesById/:id",
  verifyToken,
  checkPermission(PERMISSIONS.PRODUCT_SALE_GET_BY_ID),
  getSaleById
);

// ✅ Update Sale
router.put(
  "/updateSalesById/:id",
  verifyToken,
  checkPermission(PERMISSIONS.PRODUCT_SALE_UPDATE),
  updateSale
);

// ✅ Delete Sale
router.delete(
  "/deketeSalesById/:id",
  verifyToken,
  checkPermission(PERMISSIONS.PRODUCT_SALE_DELETE),
  deleteSale
);

export default router;
