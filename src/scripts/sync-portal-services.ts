/**
 * Sync portal service pages + submission tables.
 * Run: npm run sync:portal-services
 */

import db from "../../db";
import "../models/index";

const run = async () => {
  await db.authenticate();
  console.log("🚀 Syncing portal services tables...\n");

  const PortalService = (await import("../models/portalService.model")).default;
  await PortalService.sync({ alter: true });
  console.log("   ✓ portal_services synced");

  const PortalServiceSubmission = (
    await import("../models/portalServiceSubmission.model")
  ).default;
  await PortalServiceSubmission.sync({ alter: true });
  console.log("   ✓ portal_service_submissions synced");

  console.log("\n✅ Portal services schema sync complete.");
  process.exit(0);
};

run().catch((err) => {
  console.error("❌ Sync failed:", err);
  process.exit(1);
});
