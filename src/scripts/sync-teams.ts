/**
 * Create missing Team / TeamMember tables (teams, team_members).
 * Run from project root: npx ts-node src/scripts/sync-teams.ts
 *
 * Requires .env DB_* pointing at the target database (e.g. server).
 */

import db from "../../db";
import "../models/index";
import Team from "../models/team.model";
import TeamMember from "../models/teamMember.model";

const run = async () => {
  try {
    await db.authenticate();
    console.log("Database connection established.");

    await Team.sync();
    console.log("✅ Table `teams` ready.");

    await TeamMember.sync();
    console.log("✅ Table `team_members` ready.");
  } catch (error: any) {
    console.error("❌ Sync teams error:", error.message);
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
