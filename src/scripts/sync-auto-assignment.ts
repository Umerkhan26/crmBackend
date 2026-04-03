/**
 * Sync auto-assignment related tables and seed default team rotation config.
 * Run: npx ts-node src/scripts/sync-auto-assignment.ts
 */
import db from "../../db";
import "../models/index";
import Team from "../models/team.model";
import TeamRotationConfig from "../models/teamRotationConfig.model";
import LeadRotationState from "../models/leadRotationState.model";
import LeadAssignmentState from "../models/leadAssignmentState.model";
import LeadLock from "../models/leadLock.model";
import LeadAssignmentBatch from "../models/leadAssignmentBatch.model";

const run = async () => {
  try {
    await db.authenticate();
    console.log("Database connection established.");

    // Ensure dependent tables
    await Team.sync();
    await LeadLock.sync();
    await LeadAssignmentBatch.sync();
    await LeadRotationState.sync();
    await LeadAssignmentState.sync();
    await TeamRotationConfig.sync();

    console.log("✅ Tables synced: teams, lead_locks, lead_assignment_batches, lead_rotation_state, lead_assignment_state, team_rotation_config");

    // Seed default rotation config if none exists
    const existing = await TeamRotationConfig.findOne();
    if (!existing) {
      const teams = await Team.findAll({ order: [["sortOrder", "ASC"], ["id", "ASC"]], attributes: ["id", "code"] });
      const rotationOrder = teams.map((t: any) => t.id);
      await TeamRotationConfig.create({
        enabled: true,
        rotationOrder,
      } as any);
      console.log("🌱 Seeded default team rotation order from existing teams.");
    } else {
      console.log("ℹ️ Team rotation config already exists; skipping seed.");
    }
  } catch (error: any) {
    console.error("❌ Sync auto-assignment error:", error.message);
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
