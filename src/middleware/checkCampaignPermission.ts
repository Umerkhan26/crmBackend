import { Request, Response, NextFunction } from "express";

// export const checkCampaignPermission = (
//   action: "get" | "update" | "delete"
// ) => {
//   return (req: Request, res: Response, next: NextFunction): void => {
//     const campaignId = parseInt(req.params.id, 10);
//     const campaignName = req.params.campaignName; // Optionally passed if available
//     const userPermissions = req.user?.permissions || [];

//     const permissionNameMap: Record<string, string> = {
//       get: "getCampaignById",
//       update: "updateCampaign",
//       delete: "deleteCampaign",
//     };

//     const requiredPermissionName = permissionNameMap[action];

//     const hasPermission = userPermissions.some(
//       (perm: any) =>
//         perm.name === requiredPermissionName && perm.resourceId === campaignId
//     );

//     if (!hasPermission) {
//       res
//         .status(403)
//         .json({ message: "Forbidden: You lack permission for this campaign." });
//       return;
//     }

//     next();
//   };
// };

export const checkCampaignPermission = (action: "get") => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const campaignId = parseInt(req.params.id, 10);
    const userPermissions = req.user?.permissions || [];
    console.log("Campaign ID:", campaignId);
    console.log("User Permissions:", userPermissions);

    const permissionNameMap: Record<string, string> = {
      get: "getCampaignById",
      update: "updateCampaign",
      delete: "deleteCampaign",
    };

    const requiredPermissionName = permissionNameMap[action];

    // Check for simple string permissions (like "updateCampaign")
    const hasSimplePermission = userPermissions.includes(
      requiredPermissionName
    );

    // Check for object permissions (like {name: "updateCampaign", resourceId: 2})
    const hasObjectPermission = userPermissions.some(
      (perm: any) =>
        typeof perm === "object" &&
        perm.name === requiredPermissionName &&
        perm.resourceId === campaignId
    );

    if (!hasSimplePermission && !hasObjectPermission) {
      console.log(
        `Permission denied: Missing ${requiredPermissionName} for campaign ${campaignId}`
      );
      res
        .status(403)
        .json({ message: "Forbidden: You lack permission for this campaign." });
      return;
    }

    next();
  };
};
