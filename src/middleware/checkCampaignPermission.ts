import { Request, Response, NextFunction } from "express";

export const checkCampaignPermission = (action: "get") => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const campaignId = parseInt(req.params.id, 10);
    const userPermissions = req.user?.permissions || [];


    const permissionNameMap: Record<string, string> = {
      get: "getCampaignById",
      update: "updateCampaign",
      delete: "deleteCampaign",
    };

    const requiredPermissionName = permissionNameMap[action];

    const hasSimplePermission = userPermissions.includes(
      requiredPermissionName
    );

    const hasObjectPermission = userPermissions.some(
      (perm: any) =>
        typeof perm === "object" &&
        perm.name === requiredPermissionName &&
        perm.resourceId === campaignId
    );

    if (!hasSimplePermission && !hasObjectPermission) {

      res
        .status(403)
        .json({ message: "Forbidden: You lack permission for this campaign." });
      return;
    }

    next();
  };
};
