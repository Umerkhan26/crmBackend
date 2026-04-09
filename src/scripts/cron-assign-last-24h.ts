/**
 * Cron-friendly worker: assign non-promoted incoming_leads from the rolling last 24 hours to Team A.
 * Uses the same service as POST /auto-assignment/assign-by-date (custom window).
 *
 * Schedule via PM2/cron externally. On each invocation:
 * - Reads `enabled` and `timezone` from team_rotation_config (same as admin APIs).
 * - If disabled, exits without work.
 * - Computes [now-24h, now] in the configured timezone and calls `assignByDateToTeamA`.
 *
 * Run: npx ts-node src/scripts/cron-assign-last-24h.ts
 */
import db from "../../db";
import "../models/index";
import { DateTime } from "luxon";
import { assignByDateToTeamA, getAutoAssignmentSettings } from "../services/autoAssignment.service";

const run = async () => {
  await db.authenticate();
  const cfg = await getAutoAssignmentSettings();
  if (!cfg.enabled) {
    console.log("[cron-assign-last-24h] Auto-assignment disabled in settings — exiting.");
    return;
  }

  const zone =
    typeof cfg.timezone === "string" && cfg.timezone.trim() !== "" ? cfg.timezone.trim() : "Asia/Karachi";
  const end = DateTime.now().setZone(zone);
  const start = end.minus({ hours: 24 });

  const customStart = start.toISO();
  const customEnd = end.toISO();
  if (!customStart || !customEnd) {
    console.error("[cron-assign-last-24h] Could not build ISO window.");
    process.exitCode = 1;
    return;
  }

  console.log("[cron-assign-last-24h] Window (rolling 24h)", { tz: zone, customStart, customEnd });

  const data = await assignByDateToTeamA({
    window: "custom",
    tz: zone,
    customStart,
    customEnd,
    triggeredByUserId: undefined,
  });

  console.log("[cron-assign-last-24h] Completed.", data);
};

if (require.main === module) {
  run()
    .then(() => db.close())
    .then(() => process.exit(process.exitCode || 0))
    .catch((e) => {
      console.error("[cron-assign-last-24h] Fatal:", e?.message || e);
      db.close().finally(() => process.exit(1));
    });
}
