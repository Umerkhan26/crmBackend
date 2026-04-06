/**
 * Run: npx ts-node src/scripts/patch-missing-schema-columns.ts
 */

import db from "../../db";
import { patchMissingSchemaColumns } from "../utils/patchSchemaColumns";

const main = async () => {
  try {
    await db.authenticate();
    console.log("Database connection established.");
    await patchMissingSchemaColumns(db);
  } catch (e: any) {
    console.error("❌ Patch failed:", e?.message || e);
    throw e;
  } finally {
    await db.close();
  }
};

main()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
