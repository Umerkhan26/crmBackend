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
  const user = await User.findByPk(userId, {
    include: [{ model: Role, attributes: ["name"] }],
  });
  const roleName = String((user as any)?.Role?.name || "").toLowerCase();
  if (ADMIN_ROLE_NAMES.has(roleName)) {
    return { scope: "all", saleUserIds: [], brandIds: [] };
  }

  // Managers: team agents only — brand:get must not bypass this.
  if (await isUserManager(userId)) {
    const teamIds = await getManagerBrandUserIds(userId);
    const brandIds = await getManagerBrands(userId);
    const saleUserIds = [...new Set([userId, ...teamIds])].filter(
      (id) => Number.isFinite(id) && id > 0,
    );
    return { scope: "team", saleUserIds, brandIds };
  }

  if (permissions.includes("brand:get")) {
    return { scope: "all", saleUserIds: [], brandIds: [] };
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

  return {
    [Op.or]: [
      { assigneeId: { [Op.in]: userIds } },
      { createdBy: { [Op.in]: userIds } },
    ],
  };
}

/** Filter customer_engagements to actions by agents in the viewer's scope. */
export function buildEngagementCreatedByScopeWhere(
  scopeResult: CustomerListScopeResult,
): Record<string, unknown> | null {
  if (scopeResult.scope === "all") return null;

  const userIds = scopeResult.saleUserIds;
  if (!userIds.length) {
    return { createdBy: { [Op.in]: [] } };
  }

  return { createdBy: { [Op.in]: userIds } };
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

  if (!matchesUser) {
    throw new Error("You do not have access to this customer account");
  }
}
