import { Request, Response } from "express";
import {
  getAllEmailPermissions,
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
