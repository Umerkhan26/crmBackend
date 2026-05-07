import BrandUser from "../models/brandUser.model";
import BrandManager from "../models/brandManager.model";
import { Op } from "sequelize";

/**
 * Get all brand IDs that a user belongs to
 */
export const getUserBrands = async (userId: number): Promise<number[]> => {
  try {
    const brandUsers = await BrandUser.findAll({
      where: { userId },
      attributes: ["brandId"],
    });
    return brandUsers.map((bu) => bu.brandId);
  } catch (error) {
    console.error("Error getting user brands:", error);
    return [];
  }
};

/**
 * Get all brand IDs that a user manages (as a manager)
 */
export const getManagerBrands = async (managerId: number): Promise<number[]> => {
  try {
    const brandManagers = await BrandManager.findAll({
      where: { managerId },
      attributes: ["brandId"],
    });
    return brandManagers.map((bm) => bm.brandId);
  } catch (error) {
    console.error("Error getting manager brands:", error);
    return [];
  }
};

/**
 * Get all user IDs that belong to a specific brand
 */
export const getBrandUserIds = async (brandId: number): Promise<number[]> => {
  try {
    const brandUsers = await BrandUser.findAll({
      where: { brandId },
      attributes: ["userId"],
    });
    return brandUsers.map((bu) => bu.userId);
  } catch (error) {
    console.error("Error getting brand user IDs:", error);
    return [];
  }
};

/**
 * Get all user IDs that belong to multiple brands
 */
export const getBrandsUserIds = async (brandIds: number[]): Promise<number[]> => {
  try {
    if (brandIds.length === 0) return [];
    
    const brandUsers = await BrandUser.findAll({
      where: {
        brandId: {
          [Op.in]: brandIds,
        },
      },
      attributes: ["userId"],
    });
    
    // Get unique user IDs
    const userIds = brandUsers.map((bu) => bu.userId);
    return [...new Set(userIds)];
  } catch (error) {
    console.error("Error getting brands user IDs:", error);
    return [];
  }
};

/**
 * Get all user IDs that belong to brands managed by a manager
 */
export const getManagerBrandUserIds = async (managerId: number): Promise<number[]> => {
  try {
    // First, get all brands managed by this manager
    const managedBrandIds = await getManagerBrands(managerId);
    
    if (managedBrandIds.length === 0) return [];
    
    // Then, get all user IDs under those brands
    return await getBrandsUserIds(managedBrandIds);
  } catch (error) {
    console.error("Error getting manager brand user IDs:", error);
    return [];
  }
};

/**
 * Check if a user is a manager (has any brand manager assignments)
 */
export const isUserManager = async (userId: number): Promise<boolean> => {
  try {
    const count = await BrandManager.count({
      where: { managerId: userId },
    });
    return count > 0;
  } catch (error) {
    console.error("Error checking if user is manager:", error);
    return false;
  }
};

/**
 * Check if a user can access a brand (either as a user or as a manager)
 */
export const canUserAccessBrand = async (
  userId: number,
  brandId: number
): Promise<boolean> => {
  try {
    // Check if user belongs to the brand
    const isBrandUser = await BrandUser.findOne({
      where: { userId, brandId },
    });

    if (isBrandUser) return true;

    // Check if user is a manager of the brand
    const isManager = await BrandManager.findOne({
      where: { managerId: userId, brandId },
    });

    return !!isManager;
  } catch (error) {
    console.error("Error checking brand access:", error);
    return false;
  }
};

/**
 * Get all brand IDs accessible by a user (as user or manager)
 */
export const getAccessibleBrandIds = async (userId: number): Promise<number[]> => {
  try {
    // Get brands where user is a member
    const userBrandIds = await getUserBrands(userId);
    
    // Get brands where user is a manager
    const managerBrandIds = await getManagerBrands(userId);
    
    // Combine and get unique brand IDs
    const allBrandIds = [...userBrandIds, ...managerBrandIds];
    return [...new Set(allBrandIds)];
  } catch (error) {
    console.error("Error getting accessible brand IDs:", error);
    return [];
  }
};

/**
 * Managers assigned to brands the user can access (member or manager of brand).
 * Used to alert managers when this user requests a hot lead. Excludes self.
 */
export const getBrandManagerIdsForUser = async (userId: number): Promise<number[]> => {
  try {
    const brandIds = await getAccessibleBrandIds(userId);
    if (brandIds.length === 0) return [];

    const rows = await BrandManager.findAll({
      where: { brandId: { [Op.in]: brandIds } },
      attributes: ["managerId"],
    });

    return [...new Set(rows.map((r) => r.managerId))].filter((id) => id !== userId);
  } catch (error) {
    console.error("Error getting brand manager IDs for user:", error);
    return [];
  }
};
