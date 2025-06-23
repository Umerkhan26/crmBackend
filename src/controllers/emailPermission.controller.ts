import { Request, Response } from "express";
import {
  getAllEmailPermissions,
  getAllEmailPermissionsWithRoles,
  updateEmailPermissionByService,
} from "../services/emailPermission.service";

export const getEmailPermissions = async (_req: Request, res: Response) => {
  const permissions = await getAllEmailPermissions();
  res.json(permissions);
};

export const updateEmailPermission = async (req: Request, res: Response) => {
  try {
    const { serviceName } = req.params;
    const { canSend, allowedRoles } = req.body;

    const updated = await updateEmailPermissionByService(serviceName, { canSend, allowedRoles });
    res.json({ message: "Updated", permission: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
};


export const getEmailPermissionsWithRoles = async (_req: Request, res: Response) => {
    try {
      const permissions = await getAllEmailPermissionsWithRoles();
      res.status(200).json({
        success: true,
        message: "Email permissions with roles fetched successfully!",
        data: permissions,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  };