/**
 * Interactive assign: pick an unassigned import batch (runId) from the last 7 days,
 * then assign to Team A using the same logic as POST /auto-assignment/assign-by-date.
 *
 * Run: npx ts-node src/scripts/interactive-assign-last-7d.ts
 * Or:  npm run assign:interactive-7d
 */
import * as readline from "readline";
import { Op } from "sequelize";
import { DateTime } from "luxon";
import db from "../../db";
import "../models/index";
import IncomingLead from "../models/incomingLead.model";
import {
  assignByDateToTeamA,
  getAutoAssignmentSettings,
} from "../services/autoAssignment.service";

const LOOKBACK_DAYS = 7;

type RunIdRow = {
  runId: string;
  pending: number;
  oldest: Date;
  newest: Date;
};

const prompt = (rl: readline.Interface, question: string): Promise<string> =>
  new Promise((resolve) => rl.question(question, (answer) => resolve(answer.trim())));

const listUnassignedRunIds = async (start: Date, end: Date): Promise<RunIdRow[]> => {
  const rows = await IncomingLead.findAll({
    attributes: ["runId", "createdAt"],
    where: {
      status: { [Op.ne]: "promoted" },
      createdAt: { [Op.between]: [start, end] },
    },
    order: [["createdAt", "DESC"]],
    raw: true,
  });

  const map = new Map<string, RunIdRow>();
  for (const row of rows as Array<{ runId: string; createdAt: Date }>) {
    const runId = String(row.runId);
    const createdAt = new Date(row.createdAt);
    const existing = map.get(runId);
    if (!existing) {
      map.set(runId, {
        runId,
        pending: 1,
        oldest: createdAt,
        newest: createdAt,
      });
      continue;
    }
    existing.pending += 1;
    if (createdAt < existing.oldest) existing.oldest = createdAt;
    if (createdAt > existing.newest) existing.newest = createdAt;
  }

  return [...map.values()].sort(
    (a, b) => b.newest.getTime() - a.newest.getTime(),
  );
};

const run = async () => {
  await db.authenticate();
  const cfg = await getAutoAssignmentSettings();
  if (!cfg.enabled) {
    console.log("[interactive-assign-7d] Auto-assignment is disabled in settings — exiting.");
    return;
  }

  const zone =
    typeof cfg.timezone === "string" && cfg.timezone.trim() !== ""
      ? cfg.timezone.trim()
      : "Asia/Karachi";
  const end = DateTime.now().setZone(zone);
  const start = end.minus({ days: LOOKBACK_DAYS });
  const customStart = start.toISO();
  const customEnd = end.toISO();
  if (!customStart || !customEnd) {
    console.error("[interactive-assign-7d] Could not build ISO window.");
    process.exitCode = 1;
    return;
  }

  const startDate = start.toJSDate();
  const endDate = end.toJSDate();

  console.log("\n=== Interactive assign (last 7 days) ===");
  console.log("Timezone:", zone);
  console.log("Window:", customStart, "→", customEnd);
  console.log("Same engine as auto assign-by-date (promote → Team A members).\n");

  const batches = await listUnassignedRunIds(startDate, endDate);
  const totalPending = batches.reduce((s, b) => s + b.pending, 0);

  if (totalPending === 0) {
    console.log("No unassigned incoming leads in the last 7 days.");
    return;
  }

  console.log(`Found ${totalPending} unassigned row(s) across ${batches.length} import batch(es):\n`);
  console.log("  [0] Assign ALL unassigned in last 7 days");
  batches.forEach((b, i) => {
    console.log(
      `  [${i + 1}] runId: ${b.runId}  |  pending: ${b.pending}  |  ${b.oldest.toISOString().slice(0, 10)} … ${b.newest.toISOString().slice(0, 10)}`,
    );
  });
  console.log("  [q] Quit\n");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    const answer = await prompt(rl, "Pick a number: ");
    if (answer.toLowerCase() === "q" || answer === "") {
      console.log("Cancelled.");
      return;
    }

    const choice = Number.parseInt(answer, 10);
    if (!Number.isFinite(choice) || choice < 0 || choice > batches.length) {
      console.error("Invalid choice.");
      process.exitCode = 1;
      return;
    }

    const importRunId = choice === 0 ? undefined : batches[choice - 1]?.runId;
    const label =
      choice === 0
        ? `all-7d-${end.toFormat("yyyyLLdd")}`
        : importRunId!;

    const pendingForChoice =
      choice === 0
        ? totalPending
        : batches[choice - 1]?.pending ?? 0;

    const confirm = await prompt(
      rl,
      `Assign ${pendingForChoice} lead(s)${importRunId ? ` for runId "${importRunId}"` : " (all in window)"}? [y/N]: `,
    );
    if (confirm.toLowerCase() !== "y" && confirm.toLowerCase() !== "yes") {
      console.log("Cancelled.");
      return;
    }

    console.log("\nStarting assignment…\n");
    const data = await assignByDateToTeamA({
      window: "custom",
      tz: zone,
      customStart,
      customEnd,
      runId: label,
      importRunId,
      triggeredByUserId: undefined,
    });

    console.log("\n[interactive-assign-7d] Completed.", data);
  } finally {
    rl.close();
  }
};

if (require.main === module) {
  run()
    .then(() => db.close())
    .then(() => process.exit(process.exitCode || 0))
    .catch((e) => {
      console.error("[interactive-assign-7d] Fatal:", e?.message || e);
      db.close().finally(() => process.exit(1));
    });
}
