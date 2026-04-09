/**
 * Cron-friendly worker: rebalance teams in rotation order, then rotate by tenure when
 * a team's shuffle count exceeds its active member count (counts persist in team_rotation_config.schedulerMeta).
 *
 * Schedule via PM2/cron externally. On each invocation this script:
 * - Reads `enabled`, `rebalanceDays`, `tenureHours`, `rotationOrder`, `schedulerMeta` from DB (same source as GET /auto-assignment/settings).
 * - Skips work if disabled or `rebalanceDays` not yet elapsed since `schedulerMeta.lastRebalanceRunAt`.
 * - Otherwise runs `rebalanceTeam` per team (same service as POST /auto-assignment/rebalance-team/:teamId).
 * - After each successful rebalance, increments that team's shuffle count; if count > active members, runs `rotateByTenure` (same as POST /auto-assignment/rotate) and resets shuffle counts.
 *
 * Run: npx ts-node src/scripts/cron-rebalance-rotate.ts
 */
import db from "../../db";
import "../models/index";
import TeamMember from "../models/teamMember.model";
import TeamRotationConfig, { TeamRotationSchedulerMeta } from "../models/teamRotationConfig.model";
import { getAutoAssignmentSettings, rebalanceTeam, rotateByTenure } from "../services/autoAssignment.service";

const parseSchedulerMeta = (raw: unknown): TeamRotationSchedulerMeta => {
  let o: Record<string, unknown> = {};
  if (raw == null) {
    /* empty */
  } else if (typeof raw === "string") {
    try {
      const p = JSON.parse(raw);
      if (p && typeof p === "object") o = p as Record<string, unknown>;
    } catch {
      o = {};
    }
  } else if (typeof raw === "object") {
    o = raw as Record<string, unknown>;
  }
  const counts = o.shuffleCountByTeamId;
  const shuffleCountByTeamId: Record<string, number> = {};
  if (counts && typeof counts === "object") {
    for (const [k, v] of Object.entries(counts)) {
      const n = Number(v);
      if (Number.isFinite(n) && n >= 0) shuffleCountByTeamId[k] = Math.floor(n);
    }
  }
  return {
    lastRebalanceRunAt: typeof o.lastRebalanceRunAt === "string" ? o.lastRebalanceRunAt : undefined,
    shuffleCountByTeamId,
  };
};

const activeMemberCount = async (teamId: number): Promise<number> => {
  const rows = await TeamMember.findAll({
    where: { teamId, status: "active" },
    attributes: ["id"],
  });
  return rows.length;
};

const run = async () => {
  await db.authenticate();
  const cfgRow = await TeamRotationConfig.findOne();
  if (!cfgRow) {
    console.error("[cron-rebalance-rotate] No team_rotation_config row — run sync-auto-assignment first.");
    process.exitCode = 1;
    return;
  }

  const cfg = await getAutoAssignmentSettings();
  if (!cfg.enabled) {
    console.log("[cron-rebalance-rotate] Auto-assignment disabled in settings — exiting.");
    return;
  }

  const rebalanceDays = Number.isFinite(Number(cfg.rebalanceDays)) && Number(cfg.rebalanceDays) > 0
    ? Number(cfg.rebalanceDays)
    : 1;
  const tenureHours =
    Number.isFinite(Number(cfg.tenureHours)) && Number(cfg.tenureHours) >= 0 ? Number(cfg.tenureHours) : 24;

  const meta = parseSchedulerMeta((cfg as any).schedulerMeta);
  const now = Date.now();
  if (meta.lastRebalanceRunAt) {
    const last = new Date(meta.lastRebalanceRunAt).getTime();
    if (!Number.isNaN(last)) {
      const elapsedMs = now - last;
      const needMs = rebalanceDays * 24 * 60 * 60 * 1000;
      if (elapsedMs < needMs) {
        const nextAt = new Date(last + needMs).toISOString();
        console.log(
          `[cron-rebalance-rotate] Not due yet (rebalanceDays=${rebalanceDays}). Last run ${meta.lastRebalanceRunAt}. Next eligible ≈ ${nextAt}`,
        );
        return;
      }
    }
  }

  const rotationOrder = Array.isArray(cfg.rotationOrder) ? cfg.rotationOrder.map((x) => Number(x)).filter((x) => x > 0) : [];
  if (rotationOrder.length === 0) {
    console.error("[cron-rebalance-rotate] rotationOrder is empty — configure teams / settings.");
    process.exitCode = 1;
    return;
  }

  const shuffleCountByTeamId: Record<string, number> = { ...meta.shuffleCountByTeamId };
  const labelRunId = `cron-${Date.now().toString(36)}`;
  let ranAnyRebalance = false;

  for (const teamId of rotationOrder) {
    const members = await activeMemberCount(teamId);
    if (members === 0) {
      console.warn(`[cron-rebalance-rotate] Skipping team ${teamId} — no active members.`);
      continue;
    }

    await rebalanceTeam({
      teamId,
      triggeredByUserId: undefined,
      labelRunId,
    });
    ranAnyRebalance = true;

    const key = String(teamId);
    shuffleCountByTeamId[key] = (shuffleCountByTeamId[key] || 0) + 1;
  }

  if (!ranAnyRebalance) {
    console.warn("[cron-rebalance-rotate] No team had active members — not updating lastRebalanceRunAt.");
    return;
  }

  let shouldRotate = false;
  for (const teamId of rotationOrder) {
    const members = await activeMemberCount(teamId);
    if (members === 0) continue;
    const c = shuffleCountByTeamId[String(teamId)] || 0;
    if (c > members) {
      shouldRotate = true;
      console.log(
        `[cron-rebalance-rotate] Team ${teamId} shuffle count ${c} > members ${members} — running rotateByTenure`,
      );
      break;
    }
  }

  let didRotate = false;
  if (shouldRotate) {
    await rotateByTenure({
      tenureHours,
      triggeredByUserId: undefined,
      labelRunId,
    });
    didRotate = true;
    for (const k of Object.keys(shuffleCountByTeamId)) delete shuffleCountByTeamId[k];
  }

  const nextMeta: TeamRotationSchedulerMeta = {
    lastRebalanceRunAt: new Date().toISOString(),
    shuffleCountByTeamId,
  };

  await cfgRow.update({ schedulerMeta: nextMeta as any } as any);

  console.log("[cron-rebalance-rotate] Done.", {
    lastRebalanceRunAt: nextMeta.lastRebalanceRunAt,
    shuffleCountByTeamId: nextMeta.shuffleCountByTeamId,
    didRotate,
  });
};

if (require.main === module) {
  run()
    .then(() => db.close())
    .then(() => process.exit(process.exitCode || 0))
    .catch((e) => {
      console.error("[cron-rebalance-rotate] Fatal:", e?.message || e);
      db.close().finally(() => process.exit(1));
    });
}
