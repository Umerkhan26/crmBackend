import { Op } from "sequelize";
import db from "../../db";
import Team from "../models/team.model";
import TeamMember from "../models/teamMember.model";
import Lead from "../models/lead.model";
import LeadLock from "../models/leadLock.model";
import TeamRotationConfig from "../models/teamRotationConfig.model";
import LeadRotationState from "../models/leadRotationState.model";
import LeadAssignmentState from "../models/leadAssignmentState.model";
import IncomingLead from "../models/incomingLead.model";
import LeadAssignmentBatch from "../models/leadAssignmentBatch.model";
import { DateTime } from "luxon";
import { normalizeLeadDataInput } from "../utils/normalizeLeadData";

type Id = number;

/** DB requires unique `lead_assignment_batches.runId` — never reuse import batch ids here. */
const makeAuditBatchRunId = (prefix: string, hint?: string): string => {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  const safeHint = hint?.trim()
    ? hint
        .trim()
        .replace(/[^a-zA-Z0-9_-]/g, "")
        .slice(0, 48)
    : "";
  const base = safeHint
    ? `${prefix}-${safeHint}-${ts}-${rand}`
    : `${prefix}-${ts}-${rand}`;
  return base.slice(0, 128);
};

const getTeamByCodeA = async (): Promise<Team> => {
  const teamA =
    (await Team.findOne({ where: { code: "A" } })) ||
    (await Team.findOne({ where: { sortOrder: 1 } }));
  if (!teamA) throw new Error("Team A not found (by code or sortOrder=1)");
  return teamA;
};

const getActiveMemberUserIds = async (teamId: Id): Promise<number[]> => {
  const members = await TeamMember.findAll({
    where: { teamId, status: "active" },
    attributes: ["userId"],
    order: [["updatedAt", "DESC"]],
  });
  return members.map((m: any) => m.userId);
};

const chooseAssigneesEqualSplit = (leadIds: Id[], userIds: Id[]): Map<Id, Id> => {
  const map = new Map<Id, Id>();
  if (userIds.length === 0) return map;
  let idx = 0;
  for (const leadId of leadIds) {
    map.set(leadId, userIds[idx % userIds.length]);
    idx++;
  }
  return map;
};

/**
 * Rebalance: exact equal quotas per active member (remainder to first members in array order).
 * For each lead, prefer a member with remaining quota whose id !== current assignee; otherwise
 * any member with quota (single-member team or no alternative left).
 */
const buildRebalanceTeamAssigneePlan = (
  movableLeadIds: Id[],
  memberIds: Id[],
  leadIdToCurrentAssignee: Map<Id, Id | null | undefined>,
): Map<Id, Id> => {
  const plan = new Map<Id, Id>();
  if (movableLeadIds.length === 0 || memberIds.length === 0) return plan;

  const m = memberIds.length;
  const n = movableLeadIds.length;
  const base = Math.floor(n / m);
  const rem = n % m;
  const quotaLeft = new Map<Id, number>();
  memberIds.forEach((uid, i) => {
    quotaLeft.set(uid, base + (i < rem ? 1 : 0));
  });

  const sortedLeads = [...movableLeadIds].sort((a, b) => a - b);

  for (const leadId of sortedLeads) {
    const currentRaw = leadIdToCurrentAssignee.get(leadId);
    const current =
      currentRaw != null && Number.isFinite(Number(currentRaw)) ? Number(currentRaw) : null;

    const withQuota = memberIds.filter((uid) => (quotaLeft.get(uid) ?? 0) > 0);
    let chosen: Id;
    if (withQuota.length === 0) {
      chosen = memberIds[0];
    } else if (withQuota.length === 1) {
      chosen = withQuota[0];
    } else {
      const prefer = withQuota.filter((uid) => uid !== current);
      const pool = prefer.length > 0 ? prefer : withQuota;
      chosen = [...pool].sort((a, b) => {
        const diff = (quotaLeft.get(b) ?? 0) - (quotaLeft.get(a) ?? 0);
        if (diff !== 0) return diff;
        return a - b;
      })[0];
    }

    plan.set(leadId, chosen);
    quotaLeft.set(chosen, (quotaLeft.get(chosen) ?? 0) - 1);
  }

  return plan;
};

const getRotationOrderTeamIds = async (): Promise<number[]> => {
  let cfg = await TeamRotationConfig.findOne();
  if (!cfg) {
    const teams = await Team.findAll({
      order: [["sortOrder", "ASC"], ["id", "ASC"]],
      attributes: ["id"],
    });
    const ids = teams.map((t: any) => t.id as number);
    if (ids.length === 0) {
      throw new Error(
        "No team_rotation_config row and no teams in `teams`. Create teams, then run: npx ts-node src/scripts/sync-auto-assignment.ts",
      );
    }
    cfg = await TeamRotationConfig.create({ enabled: true, rotationOrder: ids } as any);
  }

  let order = (cfg!.get("rotationOrder") as any[]) || [];
  if (!Array.isArray(order) || order.length === 0) {
    const teams = await Team.findAll({
      order: [["sortOrder", "ASC"], ["id", "ASC"]],
      attributes: ["id"],
    });
    const ids = teams.map((t: any) => t.id as number);
    if (ids.length === 0) {
      throw new Error(
        "team_rotation_config.rotationOrder is empty and there are no teams. Add teams, then run: npx ts-node src/scripts/sync-auto-assignment.ts",
      );
    }
    await cfg!.update({ rotationOrder: ids } as any);
    order = ids;
  }

  const numeric = order.map((x) => Number(x)).filter((x) => Number.isFinite(x));
  if (numeric.length === 0) {
    throw new Error(
      "team_rotation_config.rotationOrder has no valid team ids. Fix JSON in DB or run: npx ts-node src/scripts/sync-auto-assignment.ts",
    );
  }
  return numeric;
};

const getOrCreateSettings = async () => {
  let cfg = await TeamRotationConfig.findOne();
  if (!cfg) {
    const teams = await Team.findAll({ order: [["sortOrder", "ASC"], ["id", "ASC"]], attributes: ["id"] });
    const rotationOrder = teams.map((t: any) => t.id);
    cfg = await TeamRotationConfig.create({
      enabled: true,
      rotationOrder,
      tenureHours: 24,
      rebalanceHours: 24,
      timezone: "Asia/Karachi",
      assignWindowDefault: "yesterday",
    } as any);
  }
  return cfg;
};

export const getAutoAssignmentSettings = async () => {
  const cfg = await getOrCreateSettings();
  return cfg.toJSON();
};

export const updateAutoAssignmentSettings = async ({
  enabled,
  rotationOrder,
  tenureHours,
  rebalanceHours,
  timezone,
  assignWindowDefault,
}: {
  enabled?: boolean;
  rotationOrder?: number[];
  tenureHours?: number;
  rebalanceHours?: number;
  timezone?: string;
  assignWindowDefault?: "today" | "yesterday" | "day_before_yesterday" | "custom";
}) => {
  const cfg = await getOrCreateSettings();
  const payload: any = {};
  if (enabled !== undefined) payload.enabled = enabled;
  if (rotationOrder !== undefined) payload.rotationOrder = rotationOrder;
  if (tenureHours !== undefined) payload.tenureHours = tenureHours;
  if (rebalanceHours !== undefined) payload.rebalanceHours = rebalanceHours;
  if (timezone !== undefined) payload.timezone = timezone;
  if (assignWindowDefault !== undefined) payload.assignWindowDefault = assignWindowDefault;
  await cfg.update(payload);
  return cfg.toJSON();
};

const getNextTeamId = (order: number[], currentTeamId: number): number | null => {
  const idx = order.indexOf(currentTeamId);
  if (idx === -1) return null;
  if (idx + 1 >= order.length) return null; // E is final
  return order[idx + 1];
};

const buildActiveLockWhere = (leadId: number) => ({
  leadId,
  status: "locked",
  [Op.or]: [{ lockUntil: null }, { lockUntil: { [Op.gt]: new Date() } }],
});

export const runManualAutoAssignment = async ({
  runId,
  tenureHours,
  triggeredByUserId,
}: {
  runId: string;
  tenureHours?: number;
  triggeredByUserId?: number;
}) => {
  if (!runId?.trim()) throw new Error("runId is required");
  const incomingRunId = runId.trim();
  const startedBatch = await LeadAssignmentBatch.create({
    runId: makeAuditBatchRunId("man", incomingRunId),
    triggerType: "manual",
    status: "running",
    startedAt: new Date(),
    triggeredByUserId: triggeredByUserId || null,
    metadata: { incomingRunId } as any,
  } as any);

  let rotatedCount = 0;
  let rebalancedCount = 0;
  let newAssignedCount = 0;
  const cfg = await getOrCreateSettings();
  const effectiveTenureHours = Number.isFinite(Number(tenureHours))
    ? Number(tenureHours)
    : Number((cfg as any).tenureHours || 24);

  const t = await db.transaction();
  try {
    const order = await getRotationOrderTeamIds();
    const teamA = await getTeamByCodeA();
    const teamAMembers = await getActiveMemberUserIds(teamA.id);
    if (teamAMembers.length === 0) throw new Error("No active members in Team A");

    // 1) Promote any not-promoted incoming leads for this runId into leads and assign to Team A
    const incoming = await IncomingLead.findAll({
      where: { runId, status: { [Op.ne]: "promoted" } },
      order: [["id", "ASC"]],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    const incomingIds = incoming.map((r: any) => r.id);
    if (incomingIds.length > 0) {
      const leadIds: number[] = [];
      // Create leads first
      for (const rec of incoming) {
        const payload: any = rec.get("payload") || {};
        const campaignName: string = (rec.get("campaignName") as any) || payload.campaignName || "General";
        const lead = await Lead.create(
          {
            campaignName,
            leadData: payload,
            assignees: [],
            createdBy: triggeredByUserId || null,
          } as any,
          { transaction: t },
        );
        leadIds.push((lead as any).id);
        await rec.update(
          {
            status: "promoted",
            promotedAt: new Date(),
            targetLeadId: (lead as any).id,
          } as any,
          { transaction: t },
        );
      }

      // Equal split among Team A
      const assignment = chooseAssigneesEqualSplit(leadIds, teamAMembers);
      for (const leadId of leadIds) {
        const assigneeId = assignment.get(leadId)!;
        const lead = await Lead.findByPk(leadId, { transaction: t, lock: t.LOCK.UPDATE });
        if (!lead) continue;
        const assignedAt = new Date().toISOString();
        const assignees = [
          {
            userId: assigneeId,
            status: "pending",
            assignedAt,
          },
        ];
        await lead.update({ assignees } as any, { transaction: t });
        await LeadAssignmentState.upsert(
          {
            leadId,
            teamId: teamA.id,
            currentAssigneeUserId: assigneeId,
            lastAssignedAt: new Date(),
          } as any,
          { transaction: t },
        );
        await LeadRotationState.upsert(
          {
            leadId,
            teamId: teamA.id,
            enteredTeamAt: new Date(),
          } as any,
          { transaction: t },
        );
      }
      newAssignedCount += leadIds.length;
    }

    // 2) Rotate leads whose tenure elapsed (>= tenureHours)
    const cutoff = new Date(Date.now() - effectiveTenureHours * 60 * 60 * 1000);
    const toRotate = await LeadRotationState.findAll({
      where: { enteredTeamAt: { [Op.lte]: cutoff } },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    for (const rs of toRotate) {
      const leadId = (rs as any).leadId as number;
      const currentTeamId = (rs as any).teamId as number;
      const nextTeamId = getNextTeamId(order, currentTeamId);
      if (!nextTeamId) continue; // final team
      const nextMembers = await getActiveMemberUserIds(nextTeamId);
      if (nextMembers.length === 0) continue;
      // pick next assignee round-robin by leadId for stability
      const assignee = nextMembers[leadId % nextMembers.length];
      const lead = await Lead.findByPk(leadId, { transaction: t, lock: t.LOCK.UPDATE });
      if (!lead) continue;
      // Skip locked leads
      const activeLock = await LeadLock.findOne({
        where: buildActiveLockWhere(leadId) as any,
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (activeLock) continue;

      const assignedAt = new Date().toISOString();
      const assignees = [
        {
          userId: assignee,
          status: "pending",
          assignedAt,
        },
      ];
      await lead.update({ assignees } as any, { transaction: t });
      await rs.update({ teamId: nextTeamId, enteredTeamAt: new Date() } as any, { transaction: t });
      await LeadAssignmentState.upsert(
        {
          leadId,
          teamId: nextTeamId,
          currentAssigneeUserId: assignee,
          lastAssignedAt: new Date(),
        } as any,
        { transaction: t },
      );
      rotatedCount++;
    }

    // 3) Rebalance within each team (simple equal split, skip locked)
    const teams = await Team.findAll({ attributes: ["id"], transaction: t });
    for (const team of teams) {
      const teamId = (team as any).id as number;
      const members = await getActiveMemberUserIds(teamId);
      if (members.length === 0) continue;
      const stateRows = await LeadAssignmentState.findAll({
        where: { teamId },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      const leadIds = stateRows.map((s: any) => s.leadId as number);
      if (leadIds.length === 0) continue;
      // Exclude locked
      const lockedRows = await LeadLock.findAll({
        where: { leadId: { [Op.in]: leadIds }, status: "locked" },
        attributes: ["leadId"],
        transaction: t,
      });
      const lockedSet = new Set<number>(lockedRows.map((r: any) => r.leadId as number));
      const movable = leadIds.filter((id) => !lockedSet.has(id));
      if (movable.length === 0) continue;
      const plan = chooseAssigneesEqualSplit(movable, members);
      for (const leadId of movable) {
        const assigneeId = plan.get(leadId)!;
        const lead = await Lead.findByPk(leadId, { transaction: t, lock: t.LOCK.UPDATE });
        if (!lead) continue;
        const assignedAt = new Date().toISOString();
        const assignees = [
          {
            userId: assigneeId,
            status: "pending",
            assignedAt,
          },
        ];
        await lead.update({ assignees } as any, { transaction: t });
        await LeadAssignmentState.upsert(
          {
            leadId,
            teamId,
            currentAssigneeUserId: assigneeId,
            lastAssignedAt: new Date(),
          } as any,
          { transaction: t },
        );
        rebalancedCount++;
      }
    }

    await t.commit();
    await startedBatch.update(
      {
        status: "completed",
        finishedAt: new Date(),
        rotatedCount,
        rebalancedCount,
        newAssignedCount,
      } as any,
    );
    return {
      batchId: (startedBatch as any).id,
      incomingRunId,
      rotatedCount,
      rebalancedCount,
      newAssignedCount,
    };
  } catch (e: any) {
    await t.rollback();
    await startedBatch.update(
      { status: "failed", finishedAt: new Date(), errorMessage: e.message } as any,
    );
    throw e;
  }
};

const computeWindow = ({
  window,
  tz,
  customStart,
  customEnd,
}: {
  window: "today" | "yesterday" | "day_before_yesterday" | "custom";
  tz: string;
  customStart?: string;
  customEnd?: string;
}) => {
  const zone = tz || "Asia/Karachi";
  let start: DateTime;
  let end: DateTime;
  const now = DateTime.now().setZone(zone);
  if (window === "today") {
    start = now.startOf("day");
    end = now.endOf("day");
  } else if (window === "yesterday") {
    const y = now.minus({ days: 1 });
    start = y.startOf("day");
    end = y.endOf("day");
  } else if (window === "day_before_yesterday") {
    const dby = now.minus({ days: 2 });
    start = dby.startOf("day");
    end = dby.endOf("day");
  } else {
    start = customStart ? DateTime.fromISO(customStart, { zone: zone }).startOf("second") : now.startOf("day");
    end = customEnd ? DateTime.fromISO(customEnd, { zone: zone }).endOf("second") : now.endOf("day");
  }
  return { start: start.toJSDate(), end: end.toJSDate(), zone };
};

export const assignByDateToTeamA = async ({
  window,
  tz,
  customStart,
  customEnd,
  runId,
  triggeredByUserId,
}: {
  window?: "today" | "yesterday" | "day_before_yesterday" | "custom";
  tz?: string;
  customStart?: string;
  customEnd?: string;
  runId?: string;
  triggeredByUserId?: number;
}) => {
  const cfg = await getOrCreateSettings();
  const effectiveWindow = window || ((cfg as any).assignWindowDefault as any) || "yesterday";
  const effectiveTz = tz || ((cfg as any).timezone as string) || "Asia/Karachi";
  const { start, end, zone } = computeWindow({ window: effectiveWindow, tz: effectiveTz, customStart, customEnd });
  const hint = runId?.trim() || DateTime.fromJSDate(start).toFormat("yyyyLLdd");
  const batch = await LeadAssignmentBatch.create({
    runId: makeAuditBatchRunId("asg", hint),
    triggerType: "manual",
    status: "running",
    startedAt: new Date(),
    triggeredByUserId: triggeredByUserId || null,
    metadata: {
      window: effectiveWindow,
      tz: zone,
      start,
      end,
      ...(runId?.trim() ? { labelRunId: runId.trim() } : {}),
    } as any,
  } as any);

  let newAssignedCount = 0;
  const t = await db.transaction();
  try {
    const teamA = await getTeamByCodeA();
    const members = await getActiveMemberUserIds(teamA.id);
    if (members.length === 0) throw new Error("No active members in Team A");

    const rows: InstanceType<typeof IncomingLead>[] = await IncomingLead.findAll({
      where: {
        status: { [Op.ne]: "promoted" },
        createdAt: { [Op.between]: [start, end] },
      },
      order: [["id", "ASC"]],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (rows.length === 0) {
      await t.commit();
      await batch.update({ status: "completed", finishedAt: new Date(), newAssignedCount: 0 } as any);
      return { batchId: (batch as any).id, newAssignedCount: 0 };
    }
    const leadIds: number[] = [];
    for (const rec of rows) {
      const payload: any = rec.get("payload") || {};
      const campaignName: string = (rec.get("campaignName") as any) || payload.campaignName || "General";
      const lead = await Lead.create(
        {
          campaignName,
          leadData: normalizeLeadDataInput(payload),
          assignees: [],
          createdBy: triggeredByUserId || null,
        } as any,
        { transaction: t },
      );
      leadIds.push((lead as any).id);
      await rec.update(
        { status: "promoted", promotedAt: new Date(), targetLeadId: (lead as any).id } as any,
        { transaction: t },
      );
    }
    const plan = chooseAssigneesEqualSplit(leadIds, members);
    for (const leadId of leadIds) {
      const assigneeId = plan.get(leadId)!;
      const lead = await Lead.findByPk(leadId, { transaction: t, lock: t.LOCK.UPDATE });
      if (!lead) continue;
      const assignedAt = new Date().toISOString();
      const assignees = [{ userId: assigneeId, status: "pending", assignedAt }];
      await lead.update({ assignees } as any, { transaction: t });
      await LeadAssignmentState.upsert(
        {
          leadId,
          teamId: teamA.id,
          currentAssigneeUserId: assigneeId,
          lastAssignedAt: new Date(),
        } as any,
        { transaction: t },
      );
      await LeadRotationState.upsert(
        { leadId, teamId: teamA.id, enteredTeamAt: new Date() } as any,
        { transaction: t },
      );
    }
    newAssignedCount = leadIds.length;
    await t.commit();
    await batch.update(
      { status: "completed", finishedAt: new Date(), newAssignedCount } as any,
    );
    return { batchId: (batch as any).id, newAssignedCount };
  } catch (e: any) {
    await t.rollback();
    await batch.update({ status: "failed", finishedAt: new Date(), errorMessage: e.message } as any);
    throw e;
  }
};

export const rebalanceTeam = async ({
  teamId,
  triggeredByUserId,
  labelRunId,
}: {
  teamId: number;
  triggeredByUserId?: number;
  labelRunId?: string;
}) => {
  if (!Number.isFinite(teamId) || teamId < 1) {
    throw new Error("Invalid team ID: use a positive team id from GET /teams (or your teams table).");
  }
  const teamExists = await Team.findByPk(teamId);
  if (!teamExists) {
    const sample = await Team.findAll({
      attributes: ["id", "name", "code"],
      order: [["sortOrder", "ASC"], ["id", "ASC"]],
      limit: 15,
    });
    const hint =
      sample.length > 0
        ? ` Valid ids right now: ${sample.map((t: any) => `${t.id}(${t.code || t.name})`).join(", ")}.`
        : " No teams exist yet — create teams in admin first.";
    throw new Error(`Team not found (id=${teamId}).${hint}`);
  }

  const members = await getActiveMemberUserIds(teamId);
  if (members.length === 0) {
    throw new Error(
      `No active members in team ${teamId}. Add active team_members for this team before rebalancing.`,
    );
  }

  const hint = labelRunId?.trim() || `team${teamId}`;
  const batch = await LeadAssignmentBatch.create({
    runId: makeAuditBatchRunId("rebal", hint),
    triggerType: "manual",
    status: "running",
    startedAt: new Date(),
    triggeredByUserId: triggeredByUserId || null,
    metadata: {
      operation: "rebalance-team",
      teamId,
      teamCode: (teamExists as any).get?.("code") ?? (teamExists as any).code,
      ...(labelRunId?.trim() ? { labelRunId: labelRunId.trim() } : {}),
    } as any,
  } as any);

  const t = await db.transaction();
  try {
    const states = await LeadAssignmentState.findAll({
      where: { teamId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    const leadIds = states.map((s: any) => s.leadId as number);
    if (leadIds.length === 0) {
      await t.commit();
      const meta = {
        ...(((batch as any).get("metadata") as object) || {}),
        trackedForTeam: 0,
        skippedLocked: 0,
      };
      await batch.update({
        status: "completed",
        finishedAt: new Date(),
        rebalancedCount: 0,
        metadata: meta as any,
      } as any);
      return {
        rebalanced: 0,
        trackedForTeam: 0,
        skippedLocked: 0,
        batchId: (batch as any).id,
      };
    }
  const lockedRows = await LeadLock.findAll({
    where: {
      leadId: { [Op.in]: leadIds },
      status: "locked",
      [Op.or]: [{ lockUntil: null }, { lockUntil: { [Op.gt]: new Date() } }],
    },
    attributes: ["leadId"],
    transaction: t,
  });
    const lockedSet = new Set<number>(lockedRows.map((r: any) => r.leadId as number));
    const movable = leadIds.filter((id) => !lockedSet.has(id));
    const skippedLocked = leadIds.length - movable.length;
    const leadIdToCurrentAssignee = new Map<Id, Id | null | undefined>();
    for (const s of states) {
      leadIdToCurrentAssignee.set((s as any).leadId as number, (s as any).currentAssigneeUserId as Id | null);
    }
    const plan = buildRebalanceTeamAssigneePlan(movable, members, leadIdToCurrentAssignee);
    let count = 0;
    for (const leadId of movable) {
      const assigneeId = plan.get(leadId)!;
      const lead = await Lead.findByPk(leadId, { transaction: t, lock: t.LOCK.UPDATE });
      if (!lead) continue;
      const assignedAt = new Date().toISOString();
      const assignees = [{ userId: assigneeId, status: "pending", assignedAt }];
      await lead.update({ assignees } as any, { transaction: t });
      await LeadAssignmentState.upsert(
        { leadId, teamId, currentAssigneeUserId: assigneeId, lastAssignedAt: new Date() } as any,
        { transaction: t },
      );
      count++;
    }
    await t.commit();
    const metaDone = {
      ...(((batch as any).get("metadata") as object) || {}),
      trackedForTeam: leadIds.length,
      skippedLocked,
    };
    await batch.update({
      status: "completed",
      finishedAt: new Date(),
      rebalancedCount: count,
      metadata: metaDone as any,
    } as any);
    return { rebalanced: count, trackedForTeam: leadIds.length, skippedLocked, batchId: (batch as any).id };
  } catch (e: any) {
    await t.rollback();
    await batch.update({ status: "failed", finishedAt: new Date(), errorMessage: e.message } as any);
    throw e;
  }
};

/** tenureHours 0 → cutoff is “now”, so every rotation row with enteredTeamAt ≤ now is eligible (typical testing). */
export const rotateByTenure = async ({
  tenureHours = 24,
  triggeredByUserId,
  labelRunId,
}: {
  tenureHours?: number;
  triggeredByUserId?: number;
  labelRunId?: string;
}) => {
  const th = Number.isFinite(Number(tenureHours)) && Number(tenureHours) >= 0 ? Number(tenureHours) : 24;
  const hint = labelRunId?.trim() || `h${String(th).replace(/\./g, "p")}`;
  const batch = await LeadAssignmentBatch.create({
    runId: makeAuditBatchRunId("rot", hint),
    triggerType: "manual",
    status: "running",
    startedAt: new Date(),
    triggeredByUserId: triggeredByUserId || null,
    metadata: {
      operation: "rotate",
      tenureHours: th,
      ...(labelRunId?.trim() ? { labelRunId: labelRunId.trim() } : {}),
    } as any,
  } as any);

  const t = await db.transaction();
  try {
    const cfg = await getOrCreateSettings();
    const effectiveTenureHours = Number.isFinite(Number(tenureHours))
      ? Number(tenureHours)
      : Number((cfg as any).tenureHours || 24);
    const order = await getRotationOrderTeamIds();
    const cutoff = new Date(Date.now() - effectiveTenureHours * 60 * 60 * 1000);
    const rotationRowsTotal = await LeadRotationState.count({ transaction: t });
    const toRotate = await LeadRotationState.findAll({
      where: { enteredTeamAt: { [Op.lte]: cutoff } },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    const pastTenureCount = toRotate.length;
    let rotated = 0;
    let skippedNoNext = 0;
    let skippedNoMembers = 0;
    let skippedLocked = 0;
    let skippedLeadMissing = 0;
    for (const rs of toRotate) {
      const leadId = (rs as any).leadId as number;
      const currentTeamId = (rs as any).teamId as number;
      const nextTeamId = getNextTeamId(order, currentTeamId);
      if (!nextTeamId) {
        skippedNoNext++;
        continue;
      }
      const nextMembers = await getActiveMemberUserIds(nextTeamId);
      if (nextMembers.length === 0) {
        skippedNoMembers++;
        continue;
      }
      const lock = await LeadLock.findOne({
        where: buildActiveLockWhere(leadId) as any,
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (lock) {
        skippedLocked++;
        continue;
      }
      const assignee = nextMembers[leadId % nextMembers.length];
      const lead = await Lead.findByPk(leadId, { transaction: t, lock: t.LOCK.UPDATE });
      if (!lead) {
        skippedLeadMissing++;
        continue;
      }
      const assignedAt = new Date().toISOString();
      const assignees = [{ userId: assignee, status: "pending", assignedAt }];
      await lead.update({ assignees } as any, { transaction: t });
      await rs.update({ teamId: nextTeamId, enteredTeamAt: new Date() } as any, { transaction: t });
      await LeadAssignmentState.upsert(
        {
          leadId,
          teamId: nextTeamId,
          currentAssigneeUserId: assignee,
          lastAssignedAt: new Date(),
        } as any,
        { transaction: t },
      );
      rotated++;
    }
    await t.commit();
    const metaDone = {
      ...(((batch as any).get("metadata") as object) || {}),
      cutoffAt: cutoff.toISOString(),
      rotationRowsTotal,
      pastTenureCount,
      skippedNoNext,
      skippedNoMembers,
      skippedLocked,
      skippedLeadMissing,
    };
    await batch.update({
      status: "completed",
      finishedAt: new Date(),
      rotatedCount: rotated,
      metadata: metaDone as any,
    } as any);
    return {
      rotated,
      tenureHours: th,
      cutoffAt: cutoff.toISOString(),
      rotationRowsTotal,
      pastTenureCount,
      skippedNoNext,
      skippedNoMembers,
      skippedLocked,
      skippedLeadMissing,
      batchId: (batch as any).id,
    };
  } catch (e: any) {
    await t.rollback();
    await batch.update({ status: "failed", finishedAt: new Date(), errorMessage: e.message } as any);
    throw e;
  }
};

export const deepResetByRunOrWindow = async ({
  runId,
  start,
  end,
}: {
  runId?: string;
  start?: string;
  end?: string;
}): Promise<{
  incomingDeleted: number;
  leadsDeleted: number;
  stateDeleted: { assignment: number; rotation: number; locks: number };
}> => {
  if (!runId && (!start || !end)) {
    throw new Error("Provide runId or start+end ISO timestamps to reset.");
  }
  const whereIncoming: any = {};
  if (runId) whereIncoming.runId = runId.trim();
  if (start && end) {
    const s = new Date(start);
    const e = new Date(end);
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) throw new Error("Invalid start/end");
    whereIncoming.createdAt = { [Op.between]: [s, e] };
  }

  const incomingRows: InstanceType<typeof IncomingLead>[] = await IncomingLead.findAll({
    where: whereIncoming,
    attributes: ["id", "targetLeadId"],
  });
  if (incomingRows.length === 0) {
    return {
      incomingDeleted: 0,
      leadsDeleted: 0,
      stateDeleted: { assignment: 0, rotation: 0, locks: 0 },
    };
  }
  const leadIds = incomingRows
    .map((r) => Number((r as any).targetLeadId))
    .filter((id) => Number.isFinite(id) && id > 0);

  const t = await db.transaction();
  try {
    let locksDel = 0;
    let assignDel = 0;
    let rotDel = 0;
    let leadsDel = 0;

    if (leadIds.length > 0) {
      locksDel = await LeadLock.destroy({ where: { leadId: { [Op.in]: leadIds } }, transaction: t } as any);
      assignDel = await LeadAssignmentState.destroy({ where: { leadId: { [Op.in]: leadIds } }, transaction: t } as any);
      rotDel = await LeadRotationState.destroy({ where: { leadId: { [Op.in]: leadIds } }, transaction: t } as any);
      leadsDel = await Lead.destroy({ where: { id: { [Op.in]: leadIds } }, transaction: t } as any);
    }

    const incomingDel = await IncomingLead.destroy({ where: whereIncoming, transaction: t } as any);

    await t.commit();
    return {
      incomingDeleted: incomingDel,
      leadsDeleted: leadsDel,
      stateDeleted: { assignment: assignDel, rotation: rotDel, locks: locksDel },
    };
  } catch (e) {
    await t.rollback();
    throw e;
  }
};

