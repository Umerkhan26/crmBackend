/**
 * Sync bulk email campaign tables.
 * Run: npm run sync:bulk-email
 */

import db from "../../db";
import "../models/index";

const run = async () => {
  await db.authenticate();
  console.log("🚀 Syncing bulk email tables...\n");

  const BulkEmailCampaign = (await import("../models/bulkEmailCampaign.model"))
    .default;
  await BulkEmailCampaign.sync({ alter: true });
  console.log("   ✓ bulk_email_campaigns synced");

  const BulkEmailJob = (await import("../models/bulkEmailJob.model")).default;
  await BulkEmailJob.sync({ alter: true });
  console.log("   ✓ bulk_email_jobs synced");

  console.log("\n✅ Bulk email schema sync complete.");
  process.exit(0);
};

run().catch((err) => {
  console.error("❌ Sync failed:", err);
  process.exit(1);
});
