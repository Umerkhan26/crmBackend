import Permission from "../models/permission.model";
import { PERMISSIONS } from "../constants/permissions";

export const syncPermissionsToDB = async () => {
  const values = Object.values(PERMISSIONS).map((name) => ({ name }));
  await Permission.bulkCreate(values, { ignoreDuplicates: true });
};
