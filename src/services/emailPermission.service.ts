import EmailPermission from "../models/emailPermission.model";

export const getAllEmailPermissions = async () => {
  return await EmailPermission.findAll({ order: [["serviceName", "ASC"]] });
};

export const updateEmailPermissionByService = async (
  serviceName: string,
  updates: { canSend?: boolean; allowedRoles?: string }
) => {
  const permission = await EmailPermission.findOne({ where: { serviceName } });
  if (!permission) throw new Error("Service not found");

  if (updates.canSend !== undefined) permission.canSend = updates.canSend;
  if (updates.allowedRoles !== undefined) permission.allowedRoles = updates.allowedRoles;

  await permission.save();
  return permission;
};
