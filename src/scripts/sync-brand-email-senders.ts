/**
 * Sync customer email types + brand email senders schema.
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

async function getColumnType(table: string, column: string): Promise<string> {
  const [rows] = await db.query(
    `
    SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?
  `,
    { replacements: [table, column] }
  );
  const row = Array.isArray(rows) ? (rows[0] as { COLUMN_TYPE?: string }) : null;
  return String(row?.COLUMN_TYPE || "").toLowerCase();
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

async function migrateEmailTypeColumn(table: string) {
  if (!(await columnExists(table, "emailType"))) {
    await addColumnIfMissing(
      table,
      "emailType",
      "VARCHAR(64) NOT NULL DEFAULT 'promotions'"
    );
    return;
  }
  const colType = await getColumnType(table, "emailType");
  if (colType.startsWith("enum")) {
    await db.query(
      `ALTER TABLE ${table} MODIFY COLUMN emailType VARCHAR(64) NOT NULL DEFAULT 'promotions'`
    );
    console.log(`   ✓ ${table}.emailType migrated ENUM → VARCHAR(64)`);
  } else {
    console.log(`   ✓ ${table}.emailType already VARCHAR`);
  }
}

const run = async () => {
  await db.authenticate();
  console.log("🚀 Syncing customer email types + brand senders schema...\n");

  const CustomerEmailType = (await import("../models/customerEmailType.model"))
    .default;
  await CustomerEmailType.sync({ alter: true });
  console.log("   ✓ customer_email_types table synced");

  const { seedDefaultCustomerEmailTypes, refreshCustomerEmailTypesCache, getActiveMailboxPrefixes } =
    await import("../services/customerEmailType.service");
  await seedDefaultCustomerEmailTypes();
  await refreshCustomerEmailTypesCache();
  console.log("   ✓ Default email types seeded (care, invoice, promotions)");

  const BrandEmailSender = (await import("../models/brandEmailSender.model"))
    .default;
  await BrandEmailSender.sync({ alter: true });
  console.log("   ✓ brand_email_senders table synced");

  await migrateEmailTypeColumn("bulk_email_campaigns");
  await migrateEmailTypeColumn("follow_up_sequences");

  const prefixes = getActiveMailboxPrefixes();
  if (prefixes.length) {
    const likeClauses = prefixes
      .map((p) => `LOWER(smtpUser) LIKE '${p.replace(/'/g, "''")}%'`)
      .join(" OR ");
    const [deactivated] = await db.query(`
      UPDATE brand_email_senders
      SET isActive = 0, updatedAt = NOW()
      WHERE isActive = 1
        AND (
          LOWER(smtpUser) LIKE 'support@%'
          OR NOT (${likeClauses})
        )
    `);
    const affected =
      typeof deactivated === "object" &&
      deactivated &&
      "affectedRows" in deactivated
        ? (deactivated as { affectedRows?: number }).affectedRows
        : 0;
    if (affected) {
      console.log(
        `   ✓ Deactivated ${affected} invalid sender row(s) (support@ / wrong prefix)`
      );
    }
  }

  console.log("\n✅ Customer email types + brand senders sync complete.");
  process.exit(0);
};

run().catch((err) => {
  console.error("❌ Sync failed:", err);
  process.exit(1);
});
