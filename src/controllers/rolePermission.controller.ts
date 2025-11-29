import { Request, Response } from "express";
import * as RolePermissionService from "../services/rolePermission.service";

export const getAllRolePermissionsController = async (req: Request, res: Response) => {
  try {
    const rolePermissions = await RolePermissionService.getAllRolePermissions();
    res.status(200).json({
      message: "Role-Permission relationships retrieved successfully",
      data: rolePermissions,
    });
  } catch (error: any) {
    res.status(500).json({
      message: "Error occurred while retrieving role-permission relationships",
      details: error.message,
    });
  }
};

export const getRolePermissionByIdsController = async (req: Request, res: Response) => {
  const { roleId, permissionId } = req.params;
  try {
    const rolePermission = await RolePermissionService.getRolePermissionByIds(
      Number(roleId),
      Number(permissionId)
    );
    res.status(200).json({
      message: "Role-Permission relationship retrieved successfully",
      data: rolePermission,
    });
  } catch (error: any) {
    res.status(500).json({
      message: "Error occurred while retrieving role-permission relationship",
      details: error.message,
    });
  }
};
