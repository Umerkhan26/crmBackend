/**
 * Sync email_logs open-tracking columns.
 * Run: npm run sync:email-tracking
 */
import db from "../../db";
import "../models/index";

const run = async () => {
  await db.authenticate();
  console.log("🚀 Syncing email open-tracking columns...\n");

  const EmailLog = (await import("../models/emailLog.model")).default;
  await EmailLog.sync({ alter: true });
  console.log("   ✓ email_logs synced (openToken, openedAt, openCount, customerAccountId)");

  console.log("\n✅ Email tracking schema sync complete.");
  process.exit(0);
};

run().catch((err) => {
  console.error("❌ Sync failed:", err);
  process.exit(1);
});
