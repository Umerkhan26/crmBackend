import express from "express";
import * as PermissionController from "../controllers/permission.controller";

const router = express.Router();

// Route to get all permissions
router.get("/getAllPermissions", PermissionController.getAllPermissionsController);

// Route to get a permission by ID
router.get("/getPermissionsById/:id", PermissionController.getPermissionByIdController);

export default router;
    