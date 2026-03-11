import express from "express";
import {
  createBrandController,
  getAllBrandsController,
  getBrandByIdController,
  updateBrandController,
  deleteBrandController,
  assignUsersToBrandController,
  removeUserFromBrandController,
  assignManagersToBrandController,
  removeManagerFromBrandController,
  getBrandUsersController,
  getBrandManagersController,
} from "../controllers/brand.controller";
import { verifyToken } from "../middleware/verifyToken.middleware";
import { checkPermission } from "../middleware/checkPermission";
import { PERMISSIONS } from "../constants/permissions";

const router = express.Router();

// All brand routes require authentication
router.use(verifyToken);

// Base path will be /api/brands

// Create brand
router.post(
  "/",
  checkPermission(PERMISSIONS.BRAND_CREATE),
  createBrandController,
);

// Get all brands
router.get("/", checkPermission(PERMISSIONS.BRAND_GET), getAllBrandsController);

// Get brand by ID
router.get(
  "/:id",
  checkPermission(PERMISSIONS.BRAND_GET),
  getBrandByIdController,
);

// Update brand
router.put(
  "/:id",
  checkPermission(PERMISSIONS.BRAND_UPDATE),
  updateBrandController,
);

// Delete brand
router.delete(
  "/:id",
  checkPermission(PERMISSIONS.BRAND_DELETE),
  deleteBrandController,
);

// Assign users to brand
router.post(
  "/:id/users",
  checkPermission(PERMISSIONS.BRAND_ASSIGN_USERS),
  assignUsersToBrandController,
);

// Remove user from brand
router.delete(
  "/:id/users/:userId",
  checkPermission(PERMISSIONS.BRAND_REMOVE_USERS),
  removeUserFromBrandController,
);

// Assign managers to brand
router.post(
  "/:id/managers",
  checkPermission(PERMISSIONS.BRAND_ASSIGN_MANAGERS),
  assignManagersToBrandController,
);

// Remove manager from brand
router.delete(
  "/:id/managers/:managerId",
  checkPermission(PERMISSIONS.BRAND_REMOVE_MANAGERS),
  removeManagerFromBrandController,
);

// Get brand users
router.get(
  "/:id/users",
  checkPermission(PERMISSIONS.BRAND_GET),
  getBrandUsersController,
);

// Get brand managers
router.get(
  "/:id/managers",
  checkPermission(PERMISSIONS.BRAND_GET),
  getBrandManagersController,
);

export default router;
