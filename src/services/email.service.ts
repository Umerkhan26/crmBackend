import EmailPermission from "../models/emailPermission.model";

// export const checkEmailPermission = async (
//   serviceName: string,
//   roleName: string
// ) => {
//   const permission = await EmailPermission.findOne({ where: { serviceName } });
//   if (!permission || !permission.canSend) return false;
//   if (!permission.allowedRoles) return true;

//   const roles = permission.allowedRoles.split(",").map((r) => r.trim());
//   return roles.includes(roleName);
// };

export const checkEmailPermission = async (
  serviceName: string,
  roleName: string
) => {
  const permission = await EmailPermission.findOne({ where: { serviceName } });
  if (!permission || !permission.canSend) return false;
  if (!permission.allowedRoles) return true;

  let roles: string[] = [];
  try {
    roles = JSON.parse(permission.allowedRoles); // if JSON array
  } catch (e) {
    roles = permission.allowedRoles.split(",").map((r) => r.trim()); // fallback if CSV
  }

  // ✅ Normalize case before comparing
  return roles.some((r) => r.toLowerCase() === roleName.toLowerCase());
};
