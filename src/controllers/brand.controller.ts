import { Request, Response } from "express";
import {
  createBrand,
  getAllBrands,
  getBrandById,
  updateBrand,
  deleteBrand,
  assignUsersToBrand,
  removeUserFromBrand,
  assignManagersToBrand,
  removeManagerFromBrand,
  getBrandUsers,
  getBrandManagers,
} from "../services/brand.service";

/**
 * Create a new brand
 */
export const createBrandController = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const { name, description, status } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Brand name is required",
      });
    }

    const brand = await createBrand({
      name,
      description,
      status: status || "active",
    });

    return res.status(201).json({
      success: true,
      message: "Brand created successfully",
      data: brand,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || "Error creating brand",
    });
  }
};

/**
 * Get all brands
 */
export const getAllBrandsController = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = (req.query.search as string) || "";

    const result = await getAllBrands({ page, limit, search });

    return res.status(200).json({
      success: true,
      message: "Brands retrieved successfully",
      ...result,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || "Error fetching brands",
    });
  }
};

/**
 * Get brand by ID
 */
export const getBrandByIdController = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const brandId = parseInt(req.params.id);

    if (isNaN(brandId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid brand ID",
      });
    }

    const brand = await getBrandById(brandId);

    return res.status(200).json({
      success: true,
      message: "Brand retrieved successfully",
      data: brand,
    });
  } catch (error: any) {
    if (error.message === "Brand not found") {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }
    return res.status(500).json({
      success: false,
      message: error.message || "Error fetching brand",
    });
  }
};

/**
 * Update brand
 */
export const updateBrandController = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const brandId = parseInt(req.params.id);

    if (isNaN(brandId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid brand ID",
      });
    }

    const { name, description, status } = req.body;
    const updateData: any = {};

    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (status !== undefined) updateData.status = status;

    const brand = await updateBrand(brandId, updateData);

    return res.status(200).json({
      success: true,
      message: "Brand updated successfully",
      data: brand,
    });
  } catch (error: any) {
    if (error.message === "Brand not found") {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }
    return res.status(500).json({
      success: false,
      message: error.message || "Error updating brand",
    });
  }
};

/**
 * Delete brand
 */
export const deleteBrandController = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const brandId = parseInt(req.params.id);

    if (isNaN(brandId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid brand ID",
      });
    }

    await deleteBrand(brandId);

    return res.status(200).json({
      success: true,
      message: "Brand deleted successfully",
    });
  } catch (error: any) {
    if (error.message === "Brand not found") {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }
    return res.status(500).json({
      success: false,
      message: error.message || "Error deleting brand",
    });
  }
};

/**
 * Assign users to a brand
 */
export const assignUsersToBrandController = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const brandId = parseInt(req.params.id);
    const { userIds } = req.body;

    if (isNaN(brandId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid brand ID",
      });
    }

    if (!Array.isArray(userIds)) {
      return res.status(400).json({
        success: false,
        message: "userIds must be an array",
      });
    }

    await assignUsersToBrand(brandId, userIds);

    return res.status(200).json({
      success: true,
      message: "Users assigned to brand successfully",
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || "Error assigning users to brand",
    });
  }
};

/**
 * Remove a user from a brand
 */
export const removeUserFromBrandController = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const brandId = parseInt(req.params.id);
    const userId = parseInt(req.params.userId);

    if (isNaN(brandId) || isNaN(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid brand ID or user ID",
      });
    }

    await removeUserFromBrand(brandId, userId);

    return res.status(200).json({
      success: true,
      message: "User removed from brand successfully",
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || "Error removing user from brand",
    });
  }
};

/**
 * Assign managers to a brand
 */
export const assignManagersToBrandController = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const brandId = parseInt(req.params.id);
    const { managerIds } = req.body;

    if (isNaN(brandId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid brand ID",
      });
    }

    if (!Array.isArray(managerIds)) {
      return res.status(400).json({
        success: false,
        message: "managerIds must be an array",
      });
    }

    await assignManagersToBrand(brandId, managerIds);

    return res.status(200).json({
      success: true,
      message: "Managers assigned to brand successfully",
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || "Error assigning managers to brand",
    });
  }
};

/**
 * Remove a manager from a brand
 */
export const removeManagerFromBrandController = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const brandId = parseInt(req.params.id);
    const managerId = parseInt(req.params.managerId);

    if (isNaN(brandId) || isNaN(managerId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid brand ID or manager ID",
      });
    }

    await removeManagerFromBrand(brandId, managerId);

    return res.status(200).json({
      success: true,
      message: "Manager removed from brand successfully",
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || "Error removing manager from brand",
    });
  }
};

/**
 * Get all users under a brand
 */
export const getBrandUsersController = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const brandId = parseInt(req.params.id);
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = (req.query.search as string) || "";

    if (isNaN(brandId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid brand ID",
      });
    }

    const result = await getBrandUsers(brandId, { page, limit, search });

    return res.status(200).json({
      success: true,
      message: "Brand users retrieved successfully",
      ...result,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || "Error fetching brand users",
    });
  }
};

/**
 * Get all managers of a brand
 */
export const getBrandManagersController = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const brandId = parseInt(req.params.id);
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = (req.query.search as string) || "";

    if (isNaN(brandId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid brand ID",
      });
    }

    const result = await getBrandManagers(brandId, { page, limit, search });

    return res.status(200).json({
      success: true,
      message: "Brand managers retrieved successfully",
      ...result,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || "Error fetching brand managers",
    });
  }
};
