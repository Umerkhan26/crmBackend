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
} from "../controllers/user.controller";
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

router.post("/login", login); // No permission needed for login

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
  uploadImageMiddleware("userImage"),
  checkPermission(PERMISSIONS.USER_UPDATE),
  updateUserController
);

router.delete(
  "/deleteUserById/:id",
  verifyToken,
  checkPermission(PERMISSIONS.USER_DELETE),
  deleteUserController
);

// ✅ New route: Block or Unblock a user
router.put(
  "/blockOrUnblockUser/:id",
  verifyToken,
  checkPermission(PERMISSIONS.USER_UPDATESTATUS),
  blockOrUnblockUserController
);

router.get("/get-vendors-clients", getVendorsAndClientsHandler);


export default router;
