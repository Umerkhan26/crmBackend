import { Op } from "sequelize";
import Brand, { BrandAttributes, BrandCreationAttributes } from "../models/brand.model";
import BrandUser from "../models/brandUser.model";
import BrandManager from "../models/brandManager.model";
import User from "../models/user.model";
import { getPagination, getPagingData } from "../utils/paginate";
import { buildSearchFilter } from "../utils/filterQuery";

interface PaginationParams {
  page?: number;
  limit?: number;
}

/**
 * Create a new brand
 */
export const createBrand = async (
  data: BrandCreationAttributes
): Promise<BrandAttributes> => {
  try {
    const brand = await Brand.create(data);
    return brand.toJSON();
  } catch (error: any) {
    if (error.name === "SequelizeUniqueConstraintError") {
      throw new Error("Brand with this name already exists");
    }
    throw new Error(`Error creating brand: ${error.message}`);
  }
};

/**
 * Get all brands with pagination
 */
export const getAllBrands = async ({
  page = 1,
  limit = 10,
  search = "",
}: PaginationParams & { search?: string }): Promise<any> => {
  try {
    const { offset, limit: pageLimit } = getPagination({ page, limit });
    const whereClause = buildSearchFilter(search, ["name", "description"]);

    const data = await Brand.findAndCountAll({
      where: whereClause,
      offset,
      limit: pageLimit,
      order: [["createdAt", "DESC"]],
      include: [
        {
          model: User,
          as: "users",
          attributes: ["id", "firstname", "lastname", "email"],
          through: { attributes: [] },
        },
        {
          model: User,
          as: "managers",
          attributes: ["id", "firstname", "lastname", "email"],
          through: { attributes: [] },
        },
      ],
    });

    return getPagingData(data, page, pageLimit);
  } catch (error: any) {
    throw new Error(`Error fetching brands: ${error.message}`);
  }
};

/**
 * Get brand by ID
 */
export const getBrandById = async (brandId: number): Promise<any> => {
  try {
    const brand = await Brand.findByPk(brandId, {
      include: [
        {
          model: User,
          as: "users",
          attributes: ["id", "firstname", "lastname", "email", "status"],
          through: { attributes: [] },
        },
        {
          model: User,
          as: "managers",
          attributes: ["id", "firstname", "lastname", "email", "status"],
          through: { attributes: [] },
        },
      ],
    });

    if (!brand) {
      throw new Error("Brand not found");
    }

    return brand.toJSON();
  } catch (error: any) {
    throw new Error(`Error fetching brand: ${error.message}`);
  }
};

/**
 * Update brand
 */
export const updateBrand = async (
  brandId: number,
  data: Partial<BrandAttributes>
): Promise<BrandAttributes> => {
  try {
    const brand = await Brand.findByPk(brandId);
    if (!brand) {
      throw new Error("Brand not found");
    }

    await brand.update(data);
    return brand.toJSON();
  } catch (error: any) {
    if (error.name === "SequelizeUniqueConstraintError") {
      throw new Error("Brand with this name already exists");
    }
    throw new Error(`Error updating brand: ${error.message}`);
  }
};

/**
 * Delete brand
 */
export const deleteBrand = async (brandId: number): Promise<string> => {
  try {
    const brand = await Brand.findByPk(brandId);
    if (!brand) {
      throw new Error("Brand not found");
    }

    await brand.destroy();
    return "Brand deleted successfully";
  } catch (error: any) {
    throw new Error(`Error deleting brand: ${error.message}`);
  }
};

/**
 * Assign users to a brand (adds to existing, doesn't replace)
 */
export const assignUsersToBrand = async (
  brandId: number,
  userIds: number[]
): Promise<string> => {
  try {
    const brand = await Brand.findByPk(brandId);
    if (!brand) {
      throw new Error("Brand not found");
    }

    if (userIds.length === 0) {
      return "No users to assign";
    }

    // Get existing user assignments for this brand
    const existingAssignments = await BrandUser.findAll({
      where: { brandId },
      attributes: ["userId"],
    });

    const existingUserIds = existingAssignments.map((bu) => bu.userId);

    // Filter out users that are already assigned (avoid duplicates)
    const newUserIds = userIds.filter((userId) => !existingUserIds.includes(userId));

    if (newUserIds.length === 0) {
      return "All selected users are already assigned to this brand";
    }

    // Create new assignments only for users not already assigned
    const brandUserRecords = newUserIds.map((userId) => ({
      brandId,
      userId,
    }));

    try {
      await BrandUser.bulkCreate(brandUserRecords);
    } catch (bulkError: any) {
      // Handle unique constraint errors gracefully (in case of race condition)
      if (bulkError.name === "SequelizeUniqueConstraintError") {
        // Try to create them one by one, skipping duplicates
        for (const record of brandUserRecords) {
          try {
            await BrandUser.create(record);
          } catch (createError: any) {
            // Skip if duplicate, continue with others
            if (createError.name !== "SequelizeUniqueConstraintError") {
              throw createError;
            }
          }
        }
      } else {
        throw bulkError;
      }
    }

    const addedCount = newUserIds.length;
    const skippedCount = userIds.length - newUserIds.length;

    if (skippedCount > 0) {
      return `${addedCount} user(s) assigned successfully. ${skippedCount} user(s) were already assigned.`;
    }

    return `${addedCount} user(s) assigned to brand successfully`;
  } catch (error: any) {
    throw new Error(`Error assigning users to brand: ${error.message}`);
  }
};

/**
 * Remove a user from a brand
 */
export const removeUserFromBrand = async (
  brandId: number,
  userId: number
): Promise<string> => {
  try {
    const deleted = await BrandUser.destroy({
      where: { brandId, userId },
    });

    if (deleted === 0) {
      throw new Error("User is not assigned to this brand");
    }

    return "User removed from brand successfully";
  } catch (error: any) {
    throw new Error(`Error removing user from brand: ${error.message}`);
  }
};

/**
 * Assign managers to a brand (adds to existing, doesn't replace)
 */
export const assignManagersToBrand = async (
  brandId: number,
  managerIds: number[]
): Promise<string> => {
  try {
    const brand = await Brand.findByPk(brandId);
    if (!brand) {
      throw new Error("Brand not found");
    }

    if (managerIds.length === 0) {
      return "No managers to assign";
    }

    // Get existing manager assignments for this brand
    const existingAssignments = await BrandManager.findAll({
      where: { brandId },
      attributes: ["managerId"],
    });

    const existingManagerIds = existingAssignments.map((bm) => bm.managerId);

    // Filter out managers that are already assigned (avoid duplicates)
    const newManagerIds = managerIds.filter(
      (managerId) => !existingManagerIds.includes(managerId)
    );

    if (newManagerIds.length === 0) {
      return "All selected managers are already assigned to this brand";
    }

    // Create new assignments only for managers not already assigned
    const brandManagerRecords = newManagerIds.map((managerId) => ({
      brandId,
      managerId,
    }));

    try {
      await BrandManager.bulkCreate(brandManagerRecords);
    } catch (bulkError: any) {
      // Handle unique constraint errors gracefully (in case of race condition)
      if (bulkError.name === "SequelizeUniqueConstraintError") {
        // Try to create them one by one, skipping duplicates
        for (const record of brandManagerRecords) {
          try {
            await BrandManager.create(record);
          } catch (createError: any) {
            // Skip if duplicate, continue with others
            if (createError.name !== "SequelizeUniqueConstraintError") {
              throw createError;
            }
          }
        }
      } else {
        throw bulkError;
      }
    }

    const addedCount = newManagerIds.length;
    const skippedCount = managerIds.length - newManagerIds.length;

    if (skippedCount > 0) {
      return `${addedCount} manager(s) assigned successfully. ${skippedCount} manager(s) were already assigned.`;
    }

    return `${addedCount} manager(s) assigned to brand successfully`;
  } catch (error: any) {
    throw new Error(`Error assigning managers to brand: ${error.message}`);
  }
};

/**
 * Remove a manager from a brand
 */
export const removeManagerFromBrand = async (
  brandId: number,
  managerId: number
): Promise<string> => {
  try {
    const deleted = await BrandManager.destroy({
      where: { brandId, managerId },
    });

    if (deleted === 0) {
      throw new Error("Manager is not assigned to this brand");
    }

    return "Manager removed from brand successfully";
  } catch (error: any) {
    throw new Error(`Error removing manager from brand: ${error.message}`);
  }
};

/**
 * Get all users under a brand
 */
export const getBrandUsers = async (
  brandId: number,
  { page = 1, limit = 10, search = "" }: PaginationParams & { search?: string }
): Promise<any> => {
  try {
    const { offset, limit: pageLimit } = getPagination({ page, limit });

    // Get user IDs in this brand
    const brandUsers = await BrandUser.findAll({
      where: { brandId },
      attributes: ["userId"],
    });

    const userIds = brandUsers.map((bu) => bu.userId);

    if (userIds.length === 0) {
      return getPagingData({ count: 0, rows: [] }, page, pageLimit);
    }

    const whereClause = buildSearchFilter(search, [
      "firstname",
      "lastname",
      "email",
    ]);

    const data = await User.findAndCountAll({
      where: {
        ...whereClause,
        id: {
          [Op.in]: userIds,
        },
      },
      offset,
      limit: pageLimit,
      include: [
        {
          model: require("../models/role.model").default,
          as: "role",
          attributes: ["id", "name", "description"],
        },
      ],
    });

    return getPagingData(data, page, pageLimit);
  } catch (error: any) {
    throw new Error(`Error fetching brand users: ${error.message}`);
  }
};

/**
 * Get all managers of a brand
 */
export const getBrandManagers = async (
  brandId: number,
  { page = 1, limit = 10, search = "" }: PaginationParams & { search?: string }
): Promise<any> => {
  try {
    const { offset, limit: pageLimit } = getPagination({ page, limit });

    // Get manager IDs for this brand
    const brandManagers = await BrandManager.findAll({
      where: { brandId },
      attributes: ["managerId"],
    });

    const managerIds = brandManagers.map((bm) => bm.managerId);

    if (managerIds.length === 0) {
      return getPagingData({ count: 0, rows: [] }, page, pageLimit);
    }

    const whereClause = buildSearchFilter(search, [
      "firstname",
      "lastname",
      "email",
    ]);

    const data = await User.findAndCountAll({
      where: {
        ...whereClause,
        id: {
          [Op.in]: managerIds,
        },
      },
      offset,
      limit: pageLimit,
      include: [
        {
          model: require("../models/role.model").default,
          as: "role",
          attributes: ["id", "name", "description"],
        },
      ],
    });

    return getPagingData(data, page, pageLimit);
  } catch (error: any) {
    throw new Error(`Error fetching brand managers: ${error.message}`);
  }
};
