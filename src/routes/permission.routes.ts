import express from "express";
import * as PermissionController from "../controllers/permission.controller";

const router = express.Router();

router.get("/getAllPermissions", PermissionController.getAllPermissionsController);

router.get("/getPermissionsById/:id", PermissionController.getPermissionByIdController);

export default router;
