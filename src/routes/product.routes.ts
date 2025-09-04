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
  createProduct, // ✅ new controller
  updateProduct, // ✅ new controller
  deleteProduct, // ✅ new controller
  getProductById, // ✅ new controller
  getAllProducts,
  getInvoice,
  getSalesByAssigneeIdController, // ✅ new controller
} from "../controllers/product.controller";

const router = Router();

// ✅ Convert Lead to Sale
router.post(
  "/convertLeadToSale",
  verifyToken,
  checkPermission(PERMISSIONS.SALE_CONVERT_LEAD),
  convertLeadToSale
);

// ✅ Get All Sales
router.get(
  "/getAllSales",
  verifyToken,
  checkPermission(PERMISSIONS.SALE_GET_ALL),
  getAllSales
);

// ✅ Get Sale by ID
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
// ✅ Update Sale
router.put(
  "/updateSalesById/:id",
  verifyToken,
  checkPermission(PERMISSIONS.SALE_UPDATE),
  updateSale
);

// ✅ Delete Sale
router.delete(
  "/deleteSalesById/:id",
  verifyToken,
  checkPermission(PERMISSIONS.SALE_DELETE),
  deleteSale
);

//
// ✅✅✅ New Routes for Manual Product CRUD (without lead conversion)
//

// ✅ Create Product
router.post(
  "/createProduct",
  verifyToken,
  checkPermission(PERMISSIONS.PRODUCT_CREATE),
  createProduct
);

// ✅ Get All Products
router.get(
  "/getAll",
  verifyToken,
  checkPermission(PERMISSIONS.PRODUCT_GET_ALL),
  getAllProducts
);

// ✅ Get Product by ID
router.get(
  "/getById/:id",
  verifyToken,
  checkPermission(PERMISSIONS.PRODUCT_GET_BY_ID),
  getProductById
);

// ✅ Update Product by ID
router.put(
  "/updateProduct/:id",
  verifyToken,
  checkPermission(PERMISSIONS.PRODUCT_UPDATE),
  updateProduct
);

// ✅ Delete Product by ID
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
