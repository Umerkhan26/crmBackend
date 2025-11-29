import EmailPermission from "../models/emailPermission.model";

export const checkEmailPermission = async (
  serviceName: string,
  roleName: string
) => {
  const permission = await EmailPermission.findOne({ where: { serviceName } });
  if (!permission || !permission.canSend) return false;
  if (!permission.allowedRoles) return true;

  let roles: string[] = [];
  try {
    roles = JSON.parse(permission.allowedRoles);
  } catch (e) {
    roles = permission.allowedRoles.split(",").map((r) => r.trim());
  }

  return roles.some((r) => r.toLowerCase() === roleName.toLowerCase());
};
