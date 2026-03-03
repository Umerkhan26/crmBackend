/**
 * Script to sync permissions from constants to database
 * Run: npx ts-node src/scripts/sync-permissions.ts
 */

import db from "../../db";
import "../models/index";
import { syncPermissionsToDB } from "../utils/syncPermissions";

const runSync = async () => {
  try {
    await db.authenticate();
    console.log("Database connection established.");

    await syncPermissionsToDB();
    console.log("✅ Permissions synced successfully.");
  } catch (error: any) {
    console.error("❌ Error syncing permissions:", error.message);
    throw error;
  } finally {
    await db.close();
  }
};

if (require.main === module) {
  runSync()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export default runSync;
