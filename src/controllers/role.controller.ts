import { Request, Response } from "express";
import {
  createRole,
  deleteRole,
  getAllRolesWithPermissions,
  updateRolePermissions,
} from "../services/role.service";

export const createRoleController = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const role = await createRole(req.body);
    return res.status(201).json({ message: "Role created successfully", role });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const getRolesController = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = (req.query.search as string) || ""; // ✅ added search

    const paginatedRoles = await getAllRolesWithPermissions({
      page,
      limit,
      search,
    });

    return res.status(200).json({
      success: true,
      message: "Roles retrieved successfully!",
      ...paginatedRoles, // includes totalItems, data, totalPages, currentPage
    });
  } catch (error: any) {
    console.error("Error fetching roles:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal Server Error",
    });
  }
};

// controllers/role.controller.ts
export const updateRolePermissionsController = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const roleId = parseInt(req.params.id);
    const permissions = req.body.permissions;

    // Add validation
    if (!permissions || !Array.isArray(permissions)) {
      return res.status(400).json({ message: "Permissions must be an array" });
    }

    const updated = await updateRolePermissions(roleId, permissions);
    return res
      .status(200)
      .json({ message: "Role permissions updated", roles: updated });
  } catch (error: any) {
    console.error("Error updating role permissions:", error);
    return res.status(500).json({
      message: error.message || "Failed to update role permissions",
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
};

export const deleteRoleController = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const roleId = parseInt(req.params.id);
    const result = await deleteRole(roleId);

    if (!result.success) {
      return res.status(404).json({ message: result.message });
    }

    return res.status(200).json({ message: result.message });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};
