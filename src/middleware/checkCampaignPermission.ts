import { Request, Response, NextFunction } from "express";

export const checkCampaignPermission = (action: "get" | "update" | "delete") => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const campaignId = parseInt(req.params.id, 10);
    const campaignName = req.params.campaignName; // Optionally passed if available
    const userPermissions = req.user?.permissions || [];

    const permissionNameMap: Record<string, string> = {
      get: "getCampaignById",
      update: "updateCampaign",
      delete: "deleteCampaign",
    };

    const requiredPermissionName = permissionNameMap[action];

    const hasPermission = userPermissions.some((perm: any) =>
      perm.name === requiredPermissionName &&
      perm.resourceId === campaignId
    );

    if (!hasPermission) {
      res.status(403).json({ message: "Forbidden: You lack permission for this campaign." });
      return;
    }

    next();
  };
};
