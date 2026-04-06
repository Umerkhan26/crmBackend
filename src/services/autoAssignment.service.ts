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

type Id = number;

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

const getRotationOrderTeamIds = async (): Promise<number[]> => {
  const cfg = await TeamRotationConfig.findOne();
  if (!cfg) throw new Error("Team rotation config not found");
  const order = (cfg.get("rotationOrder") as any[]) || [];
  if (!Array.isArray(order) || order.length === 0) throw new Error("Team rotation order is empty");
  return order.map((x) => Number(x)).filter((x) => Number.isFinite(x));
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
  const startedBatch = await LeadAssignmentBatch.create({
    runId: runId.trim(),
    triggerType: "manual",
    status: "running",
    startedAt: new Date(),
    triggeredByUserId: triggeredByUserId || null,
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
  const batch = await LeadAssignmentBatch.create({
    runId: runId || `assign-${DateTime.fromJSDate(start).toFormat("yyyyLLdd")}`,
    triggerType: "manual",
    status: "running",
    startedAt: new Date(),
    triggeredByUserId: triggeredByUserId || null,
    metadata: { window: effectiveWindow, tz: zone, start, end },
  } as any);

  let newAssignedCount = 0;
  const t = await db.transaction();
  try {
    const teamA = await getTeamByCodeA();
    const members = await getActiveMemberUserIds(teamA.id);
    if (members.length === 0) throw new Error("No active members in Team A");

    const rows = await IncomingLead.findAll({
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
          leadData: payload,
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

export const rebalanceTeam = async ({ teamId }: { teamId: number }) => {
  const t = await db.transaction();
  try {
    const members = await getActiveMemberUserIds(teamId);
    if (members.length === 0) throw new Error("No active members in team");
    const states = await LeadAssignmentState.findAll({
      where: { teamId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    const leadIds = states.map((s: any) => s.leadId as number);
    if (leadIds.length === 0) {
      await t.commit();
      return { rebalanced: 0 };
    }
    const lockedRows = await LeadLock.findAll({
      where: {
        leadId: { [Op.in]: leadIds },
        status: "locked",
        [Op.or]: [{ lockUntil: null }, { lockUntil: { [Op.gt]: new Date() } }],
      },
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
    const plan = chooseAssigneesEqualSplit(movable, members);
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
    return { rebalanced: count };
  } catch (e: any) {
    await t.rollback();
    throw e;
  }
};

export const rotateByTenure = async ({ tenureHours = 24 }: { tenureHours?: number }) => {
  const t = await db.transaction();
  try {
    const cfg = await getOrCreateSettings();
    const effectiveTenureHours = Number.isFinite(Number(tenureHours))
      ? Number(tenureHours)
      : Number((cfg as any).tenureHours || 24);
    const order = await getRotationOrderTeamIds();
    const cutoff = new Date(Date.now() - effectiveTenureHours * 60 * 60 * 1000);
    const toRotate = await LeadRotationState.findAll({
      where: { enteredTeamAt: { [Op.lte]: cutoff } },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    let rotated = 0;
    for (const rs of toRotate) {
      const leadId = (rs as any).leadId as number;
      const currentTeamId = (rs as any).teamId as number;
      const nextTeamId = getNextTeamId(order, currentTeamId);
      if (!nextTeamId) continue;
      const nextMembers = await getActiveMemberUserIds(nextTeamId);
      if (nextMembers.length === 0) continue;
      const lock = await LeadLock.findOne({
        where: buildActiveLockWhere(leadId) as any,
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (lock) continue;
      const assignee = nextMembers[leadId % nextMembers.length];
      const lead = await Lead.findByPk(leadId, { transaction: t, lock: t.LOCK.UPDATE });
      if (!lead) continue;
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
    return { rotated };
  } catch (e: any) {
    await t.rollback();
    throw e;
  }
};

