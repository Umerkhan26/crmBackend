/**
 * Sync all Sequelize models to the database (creates missing tables, e.g. brand_managers).
 * Run: npx ts-node src/scripts/sync-database.ts
 */

import db from "../../db";
import "../models/index";
import { patchMissingSchemaColumns } from "../utils/patchSchemaColumns";

const runSync = async () => {
  try {
    await db.authenticate();
    console.log("Database connection established.");

    await patchMissingSchemaColumns();

    // sync() creates missing tables only; alter: true can hit MySQL index limit
    await db.sync();
    console.log("✅ All tables synchronized (brand_managers, etc.).");
  } catch (error: any) {
    console.error("❌ Sync error:", error.message);
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
