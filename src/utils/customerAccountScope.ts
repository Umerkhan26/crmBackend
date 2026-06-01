import { Op } from "sequelize";
import User from "../models/user.model";
import Role from "../models/role.model";
import {
  getManagerBrandUserIds,
  getManagerBrands,
  isUserManager,
} from "./brandUtils";

const ADMIN_ROLE_NAMES = new Set(["admin", "adminn"]);

export type CustomerListScope = "all" | "own" | "team";

export interface CustomerListScopeResult {
  scope: CustomerListScope;
  /** Sales assignee / creator must match one of these (agents + team). */
  saleUserIds: number[];
  /** Optional brand filter for managers. */
  brandIds: number[];
}

export const resolveCustomerListScope = async (
  userId: number,
  permissions: string[] = [],
): Promise<CustomerListScopeResult> => {
  if (permissions.includes("brand:get")) {
    return { scope: "all", saleUserIds: [], brandIds: [] };
  }

  const user = await User.findByPk(userId, {
    include: [{ model: Role, attributes: ["name"] }],
  });
  const roleName = String((user as any)?.Role?.name || "").toLowerCase();
  if (ADMIN_ROLE_NAMES.has(roleName)) {
    return { scope: "all", saleUserIds: [], brandIds: [] };
  }

  if (await isUserManager(userId)) {
    const teamIds = await getManagerBrandUserIds(userId);
    const brandIds = await getManagerBrands(userId);
    const saleUserIds = [...new Set([userId, ...teamIds])].filter(
      (id) => Number.isFinite(id) && id > 0,
    );
    return { scope: "team", saleUserIds, brandIds };
  }

  return { scope: "own", saleUserIds: [userId], brandIds: [] };
};

/** Sequelize filters for customer_accounts list/detail (via linked sale). */
export function buildCustomerAccountSaleScopeWhere(
  scopeResult: CustomerListScopeResult,
): Record<string, unknown> | null {
  if (scopeResult.scope === "all") return null;

  const userIds = scopeResult.saleUserIds;
  if (!userIds.length) {
    return { id: { [Op.in]: [] } };
  }

  const saleUserFilter = {
    [Op.or]: [
      { assigneeId: { [Op.in]: userIds } },
      { createdBy: { [Op.in]: userIds } },
    ],
  };

  if (scopeResult.scope === "team" && scopeResult.brandIds.length > 0) {
    return {
      [Op.or]: [
        saleUserFilter,
        { brandId: { [Op.in]: scopeResult.brandIds } },
      ],
    };
  }

  return saleUserFilter;
}

export async function assertCustomerAccountAccess(
  account: {
    id: number;
    brandId?: number | null;
    sale?: { assigneeId?: number | null; createdBy?: number | null } | null;
  },
  userId: number,
  permissions: string[] = [],
): Promise<void> {
  const scopeResult = await resolveCustomerListScope(userId, permissions);
  if (scopeResult.scope === "all") return;

  const sale = account.sale;
  if (!sale) {
    throw new Error("You do not have access to this customer account");
  }

  const assigneeId = sale.assigneeId != null ? Number(sale.assigneeId) : null;
  const createdBy = sale.createdBy != null ? Number(sale.createdBy) : null;

  const matchesUser =
    (assigneeId != null && scopeResult.saleUserIds.includes(assigneeId)) ||
    (createdBy != null && scopeResult.saleUserIds.includes(createdBy));

  const matchesManagerBrand =
    scopeResult.scope === "team" &&
    account.brandId != null &&
    scopeResult.brandIds.includes(Number(account.brandId));

  if (!matchesUser && !matchesManagerBrand) {
    throw new Error("You do not have access to this customer account");
  }
}
