import { Request, Response, NextFunction } from "express";

export const checkCampaignPermission = (action: 'get' | 'update' | 'delete') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const campaignId = req.params.id;
    const userPermissions = req.user?.permissions || [];

    const requiredPermission = `campaign:${action}:${campaignId}`;

    if (!userPermissions.includes(requiredPermission)) {
      res.status(403).json({ message: "Forbidden: You lack permission for this campaign." });
      return; // ✅ Add this to avoid returning Response directly
    }

    next();
  };
};
