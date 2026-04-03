/**
 * Sync staging table for incoming leads.
 * Run: npx ts-node src/scripts/sync-incoming-leads.ts
 */
import db from "../../db";
import "../models/index";
import IncomingLead from "../models/incomingLead.model";

const run = async () => {
  try {
    await db.authenticate();
    console.log("Database connection established.");

    await IncomingLead.sync();
    console.log("✅ Table `incoming_leads` ready.");
  } catch (error: any) {
    console.error("❌ Sync incoming leads error:", error.message);
    throw error;
  } finally {
    await db.close();
  }
};

if (require.main === module) {
  run()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export default run;
