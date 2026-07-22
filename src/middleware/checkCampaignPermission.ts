import { Request, Response, NextFunction } from "express";
import { PERMISSIONS } from "../constants/permissions";
import { Campaign } from "../models/campaign.model";

type PermissionDetail = {
  name?: string;
  resourceId?: number | string | null;
  resourceType?: string | null;
};

type UserWithPermissionDetails = {
  id?: number;
  permissions?: string[];
  permissionDetails?: PermissionDetail[];
};

const normalize = (value: unknown) =>
  String(value || "")
    .toLowerCase()
    .trim();

/**
 * Campaign-scoped gate for getCampaignById.
 *
 * - Blanket `campaign:get` may read any campaign (same as /getCampaignId).
 * - Otherwise require a getCampaignById row whose resourceId matches, or
 *   whose resourceType matches `campaign-<name>` / bare campaign name.
 */
export const checkCampaignPermission = (action: "get" | "update" | "delete") => {
  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const campaignId = parseInt(req.params.id, 10);
      const user = req.user as UserWithPermissionDetails | undefined;
      const userPermissions = user?.permissions || [];
      const permissionDetails = user?.permissionDetails || [];

      const permissionNameMap: Record<string, string> = {
        get: "getCampaignById",
        update: "updateCampaign",
        delete: "deleteCampaign",
      };

      const requiredPermissionName = permissionNameMap[action];

      if (
        action === "get" &&
        (userPermissions.includes(PERMISSIONS.CAMPAIGN_GET) ||
          userPermissions.includes("campaign:get"))
      ) {
        next();
        return;
      }

      const scoped = permissionDetails.filter(
        (perm) => perm?.name === requiredPermissionName,
      );

      const matchById = scoped.some(
        (perm) =>
          perm.resourceId != null &&
          !Number.isNaN(Number(perm.resourceId)) &&
          Number(perm.resourceId) === campaignId,
      );

      if (matchById) {
        next();
        return;
      }

      // Name-scoped permissions: resolve campaign name once, then match.
      const needsNameMatch = scoped.some((perm) =>
        Boolean(String(perm.resourceType || "").trim()),
      );
      if (needsNameMatch && !Number.isNaN(campaignId)) {
        const campaign = await Campaign.findByPk(campaignId, {
          attributes: ["id", "campaignName"],
        });
        const campaignName = normalize(
          campaign?.campaignName ??
            campaign?.getDataValue?.("campaignName"),
        );
        if (campaignName) {
          const matchByName = scoped.some((perm) => {
            const rt = normalize(perm.resourceType);
            if (!rt) return false;
            if (rt === campaignName) return true;
            if (rt === `campaign-${campaignName}`) return true;
            if (rt.startsWith("campaign-")) {
              return rt.slice("campaign-".length) === campaignName;
            }
            return false;
          });
          if (matchByName) {
            next();
            return;
          }
        }
      }

      // Legacy flattened-name only (no permissionDetails available).
      if (
        permissionDetails.length === 0 &&
        userPermissions.includes(requiredPermissionName)
      ) {
        next();
        return;
      }

      res.status(403).json({
        message: "Forbidden: You lack permission for this campaign.",
      });
    } catch {
      res.status(500).json({ message: "Permission check failed" });
    }
  };
};
