import express from "express";
import * as RolePermissionController from "../controllers/rolePermission.controller";

const router = express.Router();

router.get("/getAllRolePermissions", RolePermissionController.getAllRolePermissionsController);

router.get("/getRolePermissionById/:roleId/:permissionId", RolePermissionController.getRolePermissionByIdsController);

export default router;
