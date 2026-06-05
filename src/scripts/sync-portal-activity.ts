/**
 * Sync portal activity events table.
 * Run: npm run sync:portal-activity
 */

import db from "../../db";
import "../models/index";

const run = async () => {
  await db.authenticate();
  console.log("🚀 Syncing portal activity table...\n");

  const PortalActivityEvent = (
    await import("../models/portalActivityEvent.model")
  ).default;
  await PortalActivityEvent.sync({ alter: true });
  console.log("   ✓ portal_activity_events synced");

  console.log("\n✅ Portal activity schema sync complete.");
  process.exit(0);
};

run().catch((err) => {
  console.error("❌ Sync failed:", err);
  process.exit(1);
});
