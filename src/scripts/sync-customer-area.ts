/**
 * Sync Customer Area schema (brands portal fields, brandId on leads/sales, customer_accounts).
 * Run: npx ts-node src/scripts/sync-customer-area.ts
 */

import db from "../../db";
import "../models/index";

async function columnExists(
  table: string,
  column: string
): Promise<boolean> {
  const [rows] = await db.query(`
    SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?
  `, { replacements: [table, column] });
  return Array.isArray(rows) && rows.length > 0;
}

async function addColumnIfMissing(
  table: string,
  column: string,
  definition: string
) {
  if (await columnExists(table, column)) {
    console.log(`   ✓ ${table}.${column} exists`);
    return;
  }
  await db.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  console.log(`   ✓ Added ${table}.${column}`);
}

const run = async () => {
  await db.authenticate();
  console.log("🚀 Syncing Customer Area schema...\n");

  await addColumnIfMissing("brands", "slug", "VARCHAR(100) NULL UNIQUE");
  await addColumnIfMissing("brands", "subdomain", "VARCHAR(255) NULL UNIQUE");
  await addColumnIfMissing("brands", "customerPortalUrl", "VARCHAR(500) NULL");
  await addColumnIfMissing("brands", "defaultCampaignId", "INT NULL");
  await addColumnIfMissing("brands", "salesFormConfig", "JSON NULL");

  await addColumnIfMissing("leads", "brandId", "INT NULL");
  await addColumnIfMissing("product_sales", "brandId", "INT NULL");
  await addColumnIfMissing(
    "product_sales",
    "customerProvisionedAt",
    "DATETIME NULL"
  );

  const { ensurePortalCustomersSchema } = await import(
    "./lib/portalCustomersSchema"
  );
  await ensurePortalCustomersSchema();

  const CustomerAccount = (await import("../models/customerAccount.model"))
    .default;
  await CustomerAccount.sync({ alter: true });
  console.log("   ✓ customer_accounts table synced");

  const CustomerEngagement = (await import("../models/customerEngagement.model"))
    .default;
  await CustomerEngagement.sync({ alter: true });
  console.log("   ✓ customer_engagements table synced");

  await addColumnIfMissing(
    "product_sales",
    "portalProgress",
    "JSON NULL"
  );

  const PortalAnnouncement = (await import("../models/portalAnnouncement.model"))
    .default;
  await PortalAnnouncement.sync({ alter: true });
  console.log("   ✓ portal_announcements table synced");

  const PortalPopup = (await import("../models/portalPopup.model")).default;
  await PortalPopup.sync({ alter: true });
  console.log("   ✓ portal_popups table synced");

  const PortalPopupDismissal = (
    await import("../models/portalPopupDismissal.model")
  ).default;
  await PortalPopupDismissal.sync({ alter: true });
  console.log("   ✓ portal_popup_dismissals table synced");

  const { syncPermissionsToDB } = await import("../utils/syncPermissions");
  await syncPermissionsToDB();
  console.log("   ✓ permissions synced (includes customerAccount:get/create)");

  console.log("\n✅ Customer Area schema sync complete.");
  console.log("   Next: npx ts-node src/scripts/seed-customer-role.ts");
  process.exit(0);
};

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
