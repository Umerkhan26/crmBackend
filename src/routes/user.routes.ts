import express from "express";
import {
  deleteUserController,
  getUser,
  getUsers,
  login,
  registerUser,
  updateUserController,
  blockOrUnblockUserController,
  getVendorsAndClientsHandler,
  getUserSummaryController,
} from "../controllers/user.controller";
import { getDashboardStatsController } from "../controllers/dashboard.controller";
import { checkPermission } from "../middleware/checkPermission";
import { PERMISSIONS } from "../constants/permissions";
import { verifyToken } from "../middleware/verifyToken.middleware";
import { uploadImageMiddleware } from "../middleware/uploadImage";

const router = express.Router();

router.post(
  "/registerr",
  uploadImageMiddleware("userImage"),
  // checkPermission(PERMISSIONS.USER_CREATE), // Uncomment if needed
  registerUser
);

router.post("/login", login);

router.get(
  "/getAllUsers",
  verifyToken,
  checkPermission(PERMISSIONS.USER_GET),
  getUsers
);

router.get(
  "/getUserById/:id",
  verifyToken,
  checkPermission(PERMISSIONS.USER_GET_by_Id),
  getUser
);

router.put(
  "/updateUserById/:id",
  verifyToken,
  uploadImageMiddleware("userImage", true),
  checkPermission(PERMISSIONS.USER_UPDATE),
  updateUserController
);

router.delete(
  "/deleteUserById/:id",
  verifyToken,
  checkPermission(PERMISSIONS.USER_DELETE),
  deleteUserController
);

router.put(
  "/blockOrUnblockUser/:id",
  verifyToken,
  checkPermission(PERMISSIONS.USER_UPDATESTATUS),
  blockOrUnblockUserController
);

router.get("/get-vendors-clients", getVendorsAndClientsHandler);

router.get("/users/summary", getUserSummaryController);

router.get(
  "/dashboard/stats",
  verifyToken,
  checkPermission(PERMISSIONS.USER_GET),
  getDashboardStatsController
);

export default router;
