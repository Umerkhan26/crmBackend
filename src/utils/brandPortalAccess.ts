import { Order } from "sequelize";
import Brand from "../models/brand.model";
import User from "../models/user.model";
import Role from "../models/role.model";
import { PERMISSIONS } from "../constants/permissions";

const ADMIN_ROLE_NAMES = new Set(["admin", "adminn"]);

const PORTAL_BRAND_ATTRIBUTES = [
  "id",
  "name",
  "slug",
  "subdomain",
  "customerPortalUrl",
  "defaultCampaignId",
] as const;

/** Admin / brand:get — used for customers scope & brand CRUD. */
export const canSeeAllPortalBrands = async (
  userId: number,
  permissions: string[] = [],
): Promise<boolean> => {
  if (permissions.includes("brand:get")) return true;

  const user = await User.findByPk(userId, {
    include: [{ model: Role, attributes: ["name"] }],
  });
  const roleName = String((user as any)?.Role?.name || "").toLowerCase();
  return ADMIN_ROLE_NAMES.has(roleName);
};

/**
 * Header brand picker: all active brands for agents & managers (pick any brand for sale).
 * Admin unchanged. Sales-form / sensitive actions may still check brand assignment separately.
 */
export const getPortalBrandsForUser = async (
  _userId: number,
  _permissions: string[] = [],
) => {
  return Brand.findAll({
    where: { status: "active" },
    attributes: [...PORTAL_BRAND_ATTRIBUTES],
    order: [["name", "ASC"]] as Order,
  });
};

/** Permissions that grant brand sale (convert lead) — agents/managers with lead access included. */
export const BRAND_SALE_ACCESS_PERMISSIONS: string[] = [
  PERMISSIONS.SALE_CONVERT_LEAD,
  "brandSale:complete",
  PERMISSIONS.BRAND_GET,
  PERMISSIONS.CUSTOMER_ACCOUNT_GET,
  PERMISSIONS.ASSIGNED_LEAD_GET_BY_ASSIGNEE,
  PERMISSIONS.ASSIGNED_LEAD_GET_BY_CAMPAIGN_AND_ASSIGNEE,
  PERMISSIONS.ASSIGNED_LEAD_UPDATE_STATUS,
  PERMISSIONS.LEAD_GET_ALL,
  PERMISSIONS.LEAD_UPDATE,
];

/** Any logged-in CRM user may convert a sale (same as portal brand list). */
export const canPerformBrandSale = (_permissions: string[] = []): boolean => true;

/** Agents may open sales form for any active brand shown in the header picker. */
export const canAccessBrandSalesForm = async (
  _userId: number,
  brandId: number,
  _permissions: string[] = [],
): Promise<boolean> => {
  const brand = await Brand.findByPk(brandId, {
    attributes: ["id", "status"],
  });
  return !!brand && String(brand.get("status")) === "active";
};
