import { Router } from "express";
import { verifyToken } from "../middleware/verifyToken.middleware";
import { checkPermission } from "../middleware/checkPermission";
import { PERMISSIONS } from "../constants/permissions";
import { convertLeadToSale, createProduct, deleteProduct, getAllProducts, getProductById, updateProduct } from "../controllers/product.controller";

const router = Router();

// ✅ Create Product
router.post(
  "/createProducts",
  verifyToken,
  checkPermission(PERMISSIONS.PRODUCT_CREATE),
  createProduct
);

// ✅ Get All Products
router.get(
  "/getAllProducts",
  verifyToken,
  checkPermission(PERMISSIONS.PRODUCT_GET_ALL),
  getAllProducts
);

// ✅ Get Product by ID
router.get(
  "/getProductById/:id",
  verifyToken,
  checkPermission(PERMISSIONS.PRODUCT_GET_BY_ID),
  getProductById
);

// ✅ Update Product
router.put(
  "/updateProducts/:id",
  verifyToken,
  checkPermission(PERMISSIONS.PRODUCT_UPDATE),
  updateProduct
);

// ✅ Delete Product
router.delete(
  "/deleteProducts/:id",
  verifyToken,
  checkPermission(PERMISSIONS.PRODUCT_DELETE),
  deleteProduct
);

// ✅ Convert Lead to Product Sale
router.post(
  "/convertLeadToSale/:leadId",
  verifyToken,
  checkPermission(PERMISSIONS.PRODUCT_CONVERT_LEAD),
  convertLeadToSale
);

// ✅ Get All Product Sales
// router.get(
//   "/product-sales",
//   verifyToken,
//   checkPermission(PERMISSIONS.PRODUCT_SALE_GET_ALL),
//   getAllProductSales
// );

export default router;
