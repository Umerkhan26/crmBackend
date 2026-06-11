/**
 * Create portal_customers + portalCustomerId column + backfill from legacy userId.
 * Run on server: npm run sync:portal-customers
 */

import db from "../../db";
import "../models/index";
import {
  ensurePortalCustomerIdForeignKey,
  ensurePortalCustomersSchema,
  migratePortalRelatedUserIdColumns,
  removeLegacyCustomerAccountUserIdColumn,
} from "./lib/portalCustomersSchema";

const run = async () => {
  await db.authenticate();
  const [dbRow] = (await db.query("SELECT DATABASE() AS db")) as [
    Array<{ db: string }>,
    unknown,
  ];
  console.log(`🚀 Syncing portal customers on database: ${dbRow[0]?.db}\n`);

  const userToPortal = await ensurePortalCustomersSchema();
  await migratePortalRelatedUserIdColumns(userToPortal);
  await removeLegacyCustomerAccountUserIdColumn();
  await ensurePortalCustomerIdForeignKey();

  console.log("\n✅ Done.");
  console.log("   Optional: npm run migrate:portal-customers (cleans users + activity tables)");
  console.log("   Then restart: pm2 restart all");
  process.exit(0);
};

run().catch((err) => {
  console.error("❌ Sync failed:", err);
  process.exit(1);
});
