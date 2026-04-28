/**
 * Cron-friendly worker: unlock expired lead locks.
 *
 * Schedule via cron/PM2 externally (e.g. every 5-10 minutes). On each invocation:
 * - Finds rows in `lead_locks` where status is `locked` and lockUntil <= now.
 * - Sets status to `unlocked` and fills `unlockedAt` (if missing).
 *
 * Run: npx ts-node src/scripts/cron-unlock-expired-lead-locks.ts
 */
import { Op } from "sequelize";
import db from "../../db";
import "../models/index";
import LeadLock from "../models/leadLock.model";

const run = async () => {
  await db.authenticate();

  const now = new Date();
  const [updatedCount] = await LeadLock.update(
    {
      status: "unlocked",
      unlockedAt: now,
    } as any,
    {
      where: {
        status: "locked",
        lockUntil: { [Op.lte]: now },
      } as any,
    },
  );

  console.log("[cron-unlock-expired-lead-locks] Done.", {
    unlockedCount: updatedCount,
    at: now.toISOString(),
  });
};

if (require.main === module) {
  run()
    .then(() => db.close())
    .then(() => process.exit(process.exitCode || 0))
    .catch((e) => {
      console.error("[cron-unlock-expired-lead-locks] Fatal:", e?.message || e);
      db.close().finally(() => process.exit(1));
    });
}
