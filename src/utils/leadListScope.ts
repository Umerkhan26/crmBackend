import { Request } from "express";
import { PERMISSIONS } from "../constants/permissions";

export type LeadListScope = {
  userId: number;
  /** True when user has lead:scopeAll — unscoped list (permission-based, not role name). */
  isAdmin: boolean;
  isManager: boolean;
  managerBrandUserIds: number[];
};

/**
 * Resolve list/detail data scope for Master + Unified lead pages.
 * - lead:scopeAll → all leads
 * - brand manager → team (brand users)
 * - else → own (createdBy = userId)
 */
export const resolveLeadListScope = async (
  req: Request,
): Promise<LeadListScope | null> => {
  const userId = (req as any).user?.id as number | undefined;
  if (!userId) return null;

  const perms: string[] = (req as any).user?.permissions || [];
  const hasGlobalScope = perms.includes(PERMISSIONS.LEAD_SCOPE_ALL);

  const { isUserManager, getManagerBrandUserIds } = await import(
    "../utils/brandUtils"
  );
  const isManager = !hasGlobalScope && (await isUserManager(userId));
  const managerBrandUserIds = isManager
    ? await getManagerBrandUserIds(userId)
    : [];

  return {
    userId,
    isAdmin: hasGlobalScope,
    isManager,
    managerBrandUserIds,
  };
};
