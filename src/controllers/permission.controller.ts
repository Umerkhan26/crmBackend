import { Request, Response } from "express";
import * as PermissionService from "../services/permission.service";

export const getAllPermissionsController = async (req: Request, res: Response) => {
  try {
    const permissions = await PermissionService.getAllPermissions();
    res.status(200).json({
      message: "Permissions retrieved successfully",
      data: permissions,
    });
  } catch (error: any) {
    res.status(500).json({
      message: "Error occurred while retrieving permissions",
      details: error.message,
    });
  }
};

export const getPermissionByIdController = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const permission = await PermissionService.getPermissionById(Number(id));
    res.status(200).json({
      message: "Permission retrieved successfully",
      data: permission,
    });
  } catch (error: any) {
    res.status(500).json({
      message: "Error occurred while retrieving permission",
      details: error.message,
    });
  }
};
