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
    // Use alter for iterative development fields (e.g., lockUntil)
    await LeadLock.sync({ alter: true });
    await LeadAssignmentBatch.sync();
    await LeadRotationState.sync();
    // Use alter for iterative development fields (e.g., seenUserIds, cycleStep)
    await LeadAssignmentState.sync({ alter: true });
    await TeamRotationConfig.sync();

    console.log("✅ Tables synced: teams, lead_locks, lead_assignment_batches, lead_rotation_state, lead_assignment_state, team_rotation_config");

    const teams = await Team.findAll({
      order: [["sortOrder", "ASC"], ["id", "ASC"]],
      attributes: ["id", "code"],
    });
    const rotationOrder = teams.map((t: any) => t.id);

    if (rotationOrder.length === 0) {
      console.warn(
        "⚠️ No rows in `teams` — create teams first, then re-run this script to fill rotation order.",
      );
    }

    const existing = await TeamRotationConfig.findOne();
    const currentOrder = existing ? ((existing.get("rotationOrder") as any[]) || []) : [];
    const orderEmpty = !Array.isArray(currentOrder) || currentOrder.length === 0;

    if (!existing) {
      await TeamRotationConfig.create({
        enabled: true,
        rotationOrder,
        tenureHours: 24,
        rebalanceHours: 24,
        timezone: "Asia/Karachi",
        assignWindowDefault: "yesterday",
      } as any);
      console.log("🌱 Created team_rotation_config. rotationOrder:", rotationOrder);
    } else if (orderEmpty && rotationOrder.length > 0) {
      await existing.update({ rotationOrder } as any);
      console.log("🔧 Backfilled empty rotationOrder from teams:", rotationOrder);
    } else if (orderEmpty) {
      console.warn(
        "⚠️ team_rotation_config exists but rotationOrder is empty and there are no teams to copy ids from.",
      );
    } else {
      console.log("ℹ️ team_rotation_config already has a non-empty rotationOrder; left unchanged.");
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
