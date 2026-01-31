import Permission from "../models/permission.model";
import { PERMISSIONS } from "../constants/permissions";

export const syncPermissionsToDB = async () => {
  try {
    const values = Object.values(PERMISSIONS).map((name) => ({ name }));
    
    // Log what we're syncing
    const callPermissions = values.filter(v => v.name?.includes("call"));
    console.log("📋 Syncing permissions:", {
      total: values.length,
      callPermissions: callPermissions.map(v => v.name),
    });
    
    // Use bulkCreate with ignoreDuplicates to add missing permissions
    const result = await Permission.bulkCreate(values, { 
      ignoreDuplicates: true,
      returning: true,
    });
    
    // Verify call permissions were added
    const callPermsInDB = await Permission.findAll({
      where: {
        name: ["call:create", "call:get", "call:delete"],
      },
    });
    
    if (callPermsInDB.length === 3) {
      console.log("✅ Call permissions verified in database:", callPermsInDB.map(p => p.name));
    } else {
      console.warn("⚠️  Some call permissions missing:", {
        found: callPermsInDB.map(p => p.name),
        expected: ["call:create", "call:get", "call:delete"],
      });
    }
    
    return result;
  } catch (error: any) {
    console.error("❌ Error syncing permissions:", error);
    throw error;
  }
};
