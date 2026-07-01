/**
 * Sync brand email senders + emailType columns on bulk/follow-up tables.
 * Run: npm run sync:brand-email-senders
 */

import db from "../../db";
import "../models/index";

async function columnExists(table: string, column: string): Promise<boolean> {
  const [rows] = await db.query(
    `
    SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?
  `,
    { replacements: [table, column] }
  );
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
  console.log("🚀 Syncing brand email senders schema...\n");

  const BrandEmailSender = (await import("../models/brandEmailSender.model"))
    .default;
  await BrandEmailSender.sync({ alter: true });
  console.log("   ✓ brand_email_senders table synced");

  await addColumnIfMissing(
    "bulk_email_campaigns",
    "emailType",
    "ENUM('care','invoice','promotions') NOT NULL DEFAULT 'promotions'"
  );

  await addColumnIfMissing(
    "follow_up_sequences",
    "emailType",
    "ENUM('care','invoice','promotions') NOT NULL DEFAULT 'promotions'"
  );

  console.log("\n✅ Brand email senders schema sync complete.");
  process.exit(0);
};

run().catch((err) => {
  console.error("❌ Sync failed:", err);
  process.exit(1);
});
