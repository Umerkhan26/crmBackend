
import LeadActivity from "../models/leadActivity.model";
import User from "../models/user.model";
import Lead from "../models/lead.model";
import { getPagination, getPagingData } from "../utils/paginate";
import { Op, Sequelize } from "sequelize";
import Note from "../models/note.model";
import ActivityLog from "../models/activityLog.model";
import { DateTime } from "luxon";
import {
  getPktMonthlyShiftWindow,
  getPktShiftDailyWindow,
  getPktWeeklyShiftWindow,
  PKT_ZONE,
} from "../utils/pktReportingWindows";
interface ReportUser {
  user: any;
  totalActivities: number;
  leadsWorkedOn: Map<number, string>;
  lastActivityAt: Date;
  notesCount: number;
  remindersCount: number;
  statusChangeHistory?: any[];

}

export const getLeadActivitiesByLeadId = async (
  leadId: number,
  page: number = 1,
  limit: number = 10,
  performedBy?: number,
) => {
  const { offset } = getPagination({ page, limit });

  const where: any = { entityId: leadId, entityType: "lead" };
  if (
    performedBy != null &&
    Number.isFinite(Number(performedBy)) &&
    Number(performedBy) > 0
  ) {
    where.performedBy = Number(performedBy);
  }

  const data = await LeadActivity.findAndCountAll({
    where,
    order: [["createdAt", "DESC"]],
    limit,
    offset,
    include: [
      {
        model: User,
        as: "performedByUser",
        attributes: { exclude: ["password"] },
      },
      {
        model: Lead,
        as: "LeadById",
        attributes: ["id", "campaignName"],
        required: false,
      },
    ],
  });

  // Normalize campaign onto each row for FE (Lead / LeadById / campaignName)
  const rows = data.rows.map((row) => {
    const plain: any =
      typeof (row as any).get === "function"
        ? (row as any).get({ plain: true })
        : row;
    const campaignName =
      plain?.LeadById?.campaignName || plain?.Lead?.campaignName || null;
    return {
      ...plain,
      campaignName,
      Lead: plain.LeadById
        ? {
            id: plain.LeadById.id,
            campaignName: plain.LeadById.campaignName,
          }
        : plain.Lead || null,
    };
  });

  return getPagingData({ count: data.count, rows }, page, limit);
};


export const getActivitiesByEntity = async (
  entityId: number,
  entityType: "lead" | "clientLead",
  page: number = 1,
  limit: number = 10
) => {
  const { offset } = getPagination({ page, limit });

  const data = await LeadActivity.findAndCountAll({
    where: { entityId, entityType },
    order: [["createdAt", "DESC"]],
    limit,
    offset,
    include: [
      {
        model: User,
        as: "performedByUser",
        attributes: { exclude: ["password"] },
      },
    ],
  });

  return getPagingData(data, page, limit);
};

export const getAllLeadActivities = async (
  page: number = 1,
  limit: number = 10
) => {
  const { offset } = getPagination({ page, limit });

  const data = await LeadActivity.findAndCountAll({
    order: [["createdAt", "DESC"]],
    limit,
    offset,
  });

  return getPagingData(data, page, limit);
};

export const updateLeadActivity = async (
  id: number,
  data: Partial<LeadActivity>
) => {
  const activity = await LeadActivity.findByPk(id);
  if (!activity) {
    throw new Error("Lead activity not found");
  }
  await activity.update(data);
  return activity;
};

export const deleteLeadActivity = async (id: number, deletedBy: number) => {
  const activity = await LeadActivity.findByPk(id);
  if (!activity) {
    throw new Error("Lead activity not found");
  }

  await (ActivityLog as any).create({
    userId: deletedBy,
    entityType: "leadActivity",
    entityId: id,
    action: "delete",
    description: `Lead activity ID ${id} deleted by user ${deletedBy}`,
  });


  await activity.destroy();
  return { message: "Lead activity deleted and logged" };
};

/** Same window as `LeadreportByUser` (PKT shift presets or raw custom dates). */
export function resolveActivityReportRangeForUser(
  period: "daily" | "weekly" | "monthly" | "custom",
  customFilter: Record<string, any> = {},
): { startDate: Date; endDate: Date; restFilter: Record<string, any> } {
  let startDate: Date;
  let endDate: Date;
  const hasCustomDates = customFilter.startDate && customFilter.endDate;
  let restFilter: Record<string, any> = { ...customFilter };
  if (hasCustomDates) {
    startDate = new Date(customFilter.startDate as string);
    endDate = new Date(customFilter.endDate as string);
    const { startDate: _s, endDate: _e, ...clean } = restFilter;
    restFilter = clean;
  } else {
    const now = DateTime.now().setZone(PKT_ZONE);

    if (period === "daily") {
      const { start, end } = getPktShiftDailyWindow(now);
      startDate = start.toJSDate();
      endDate = end.toJSDate();
    } else if (period === "weekly") {
      const { start, end } = getPktWeeklyShiftWindow(now);
      startDate = start.toJSDate();
      endDate = end.toJSDate();
    } else {
      const { start, end } = getPktMonthlyShiftWindow(now);
      startDate = start.toJSDate();
      endDate = end.toJSDate();
    }
  }
  return { startDate, endDate, restFilter };
}

/** Distinct lead IDs the user touched via activities or notes in the range (matches activity report). */
export async function getTouchedLeadIdsForUserInDateRange(
  userId: number,
  startDate: Date,
  endDate: Date,
  restFilter: Record<string, any> = {},
): Promise<number[]> {
  const activities = await LeadActivity.findAll({
    where: {
      entityType: { [Op.in]: ["lead", "lead_status", "status_change"] },
      createdAt: { [Op.between]: [startDate, endDate] },
      performedBy: userId,
      ...restFilter,
    },
    attributes: ["entityType", "entityId"],
    include: [{ model: Lead, as: "LeadById", attributes: ["id"] }],
  });
  const notes = await Note.findAll({
    where: {
      notebleType: "lead",
      createdAt: { [Op.between]: [startDate, endDate] },
      createdBy: userId,
      ...restFilter,
    },
    attributes: ["notebleId"],
  });

  const touchedLeadIds = new Set<number>();
  for (const act of activities) {
    const a = act as any;
    const lid =
      a.LeadById?.id ??
      a.Lead?.id ??
      (a.entityType === "lead" && typeof a.entityId === "number"
        ? a.entityId
        : undefined);
    if (typeof lid === "number" && !Number.isNaN(lid)) touchedLeadIds.add(lid);
  }
  for (const note of notes) {
    const nid = Number((note as any).notebleId);
    if (!Number.isNaN(nid)) touchedLeadIds.add(nid);
  }
  return Array.from(touchedLeadIds);
}

/** Status keys on assignee rows (must match Lead model / user reports UI). */
export const REPORT_STATUS_KEYS = [
  "pending",
  "to_call",
  "interested",
  "most_interested",
  "sold",
  "not_answered",
  "not_interested",
  "hot_lead",
  "lead_rejected",
] as const;

const parseAssigneesFromLeadRow = (lead: any): any[] => {
  try {
    if (typeof lead.assignees === "string") {
      const t = lead.assignees.trim();
      if (!t) return [];
      const p = JSON.parse(lead.assignees);
      return Array.isArray(p) ? p : [];
    }
    return Array.isArray(lead.assignees) ? lead.assignees : [];
  } catch {
    return [];
  }
};

/** Current assignee status for this user on a lead (empty status → pending). */
export const effectiveAssigneeStatusForUser = (
  lead: any,
  userId: number,
): (typeof REPORT_STATUS_KEYS)[number] | null => {
  const entry = parseAssigneesFromLeadRow(lead).find(
    (a: any) => Number(a?.userId) === Number(userId),
  );
  if (!entry) return null;
  const raw = String(entry.status ?? "")
    .toLowerCase()
    .trim();
  const eff = raw || "pending";
  if (!(REPORT_STATUS_KEYS as readonly string[]).includes(eff)) return null;
  return eff as (typeof REPORT_STATUS_KEYS)[number];
};

/**
 * Status breakdown for leads the user touched in the period (activities + notes),
 * bucketed by current assignee status — same basis as `totalLeadsWorkedOn`.
 */
export async function getStatusCountsForUserActivityPeriod(
  userId: number,
  period: "daily" | "weekly" | "monthly" | "custom",
  customFilter: Record<string, any> = {},
): Promise<{
  statusCounts: Record<string, number>;
  leadsByStatus: Record<string, any[]>;
}> {
  const { startDate, endDate, restFilter } = resolveActivityReportRangeForUser(
    period,
    customFilter,
  );
  const touchedIds = await getTouchedLeadIdsForUserInDateRange(
    userId,
    startDate,
    endDate,
    restFilter,
  );

  const statusCounts: Record<string, number> = {};
  const leadsByStatus: Record<string, any[]> = {};
  for (const status of REPORT_STATUS_KEYS) {
    statusCounts[status] = 0;
    leadsByStatus[status] = [];
  }

  if (touchedIds.length === 0) {
    return { statusCounts, leadsByStatus };
  }

  const touchedLeads = await Lead.findAll({
    where: { id: { [Op.in]: touchedIds } },
    order: [["createdAt", "DESC"]],
  });

  for (const lead of touchedLeads) {
    const status = effectiveAssigneeStatusForUser(lead, userId);
    if (!status) continue;
    statusCounts[status]++;
    leadsByStatus[status].push(
      typeof (lead as any).toJSON === "function"
        ? (lead as any).toJSON()
        : lead,
    );
  }

  return { statusCounts, leadsByStatus };
}

export const getLeadActivityReportByUser = async (
  userId: number,
  period: "daily" | "weekly" | "monthly" | "custom",
  customFilter: Record<string, any> = {},
) => {
  const { startDate, endDate, restFilter } = resolveActivityReportRangeForUser(
    period,
    customFilter,
  );
  const activities = await LeadActivity.findAll({
    where: {
      entityType: { [Op.in]: ["lead", "lead_status", "status_change"] },
      createdAt: { [Op.between]: [startDate, endDate] },
      performedBy: userId,
      ...restFilter,
    },
    include: [
      {
        model: User,
        as: "performedByUser",
        attributes: ["id", "firstname", "email"],
      },
      { model: Lead, as: "LeadById" },
    ],
    order: [["createdAt", "DESC"]],
  });
  const notes = await Note.findAll({
    where: {
      notebleType: "lead",
      createdAt: { [Op.between]: [startDate, endDate] },
      createdBy: userId,
      ...restFilter,
    },
    include: [
      {
        model: User,
        as: "creator",
        attributes: ["id", "firstname", "email"],
      },
    ],
  });

  const touchedLeadIds = new Set<number>();
  for (const act of activities) {
    const a = act as any;
    const lid =
      a.LeadById?.id ??
      a.Lead?.id ??
      (a.entityType === "lead" ? a.entityId : undefined);
    if (typeof lid === "number" && !Number.isNaN(lid)) touchedLeadIds.add(lid);
  }
  for (const note of notes) {
    const nid = Number(note.notebleId);
    if (!Number.isNaN(nid)) touchedLeadIds.add(nid);
  }
  const touchedIds = Array.from(touchedLeadIds);

  // Only enrich with lead/status rows for leads the user actually touched in the
  // period (activities + notes). A blanket updatedAt filter would count every
  // assigned lead whose row changed for any reason (bulk ops, imports, others).
  const statusUpdatesWhere: any = {
    ...restFilter,
    [Op.and]: [
      Sequelize.literal(
        `JSON_CONTAINS(assignees, JSON_OBJECT('userId', ${userId}))`,
      ),
      { id: { [Op.in]: touchedIds } },
    ],
  };
  const statusUpdates =
    touchedIds.length > 0
      ? await Lead.findAll({
          where: statusUpdatesWhere,
        })
      : [];
  const report: ReportUser = {
    user: activities[0]?.performedByUser ||
      notes[0]?.creator || { id: userId, name: "Unknown User" },
    totalActivities: 0,
    leadsWorkedOn: new Map(),
    lastActivityAt: startDate,
    notesCount: 0,
    remindersCount: 0,
    statusChangeHistory: [],
  };
  for (const act of activities) {
    report.totalActivities++;
    const a = act as any;
    const lead = a.LeadById ?? a.Lead;
    const leadId: number | undefined =
      typeof lead?.id === "number" && !Number.isNaN(lead.id)
        ? lead.id
        : a.entityType === "lead" && typeof a.entityId === "number"
          ? a.entityId
          : undefined;
    const leadName =
      lead?.leadData?.name ||
      lead?.leadData?.fullName ||
      lead?.leadCode ||
      (typeof leadId === "number" ? `Lead #${leadId}` : undefined);
    if (typeof leadId === "number" && !Number.isNaN(leadId)) {
      report.leadsWorkedOn.set(leadId, leadName || `Lead #${leadId}`);
    }
    if (act.createdAt > report.lastActivityAt) {
      report.lastActivityAt = act.createdAt;
    }
  }
  for (const note of notes) {
    if (note.type === "comment") report.notesCount++;
    if (note.type === "reminder") report.remindersCount++;
    report.leadsWorkedOn.set(note.notebleId, `Lead #${note.notebleId}`);
    if (note.createdAt > report.lastActivityAt) {
      report.lastActivityAt = note.createdAt;
    }
  }
  for (const lead of statusUpdates) {
    const assignee = parseAssigneesFromLeadRow(lead).find(
      (a: any) => Number(a?.userId) === Number(userId),
    );
    if (assignee) {
      const leadName =
        lead.leadData?.name || lead.leadData?.fullName || lead.leadCode || `Lead #${lead.id}`;
      report.leadsWorkedOn.set(lead.id, leadName);
      report.statusChangeHistory?.push({
        leadId: lead.id,
        leadName,
        newStatus: assignee.status,
        changedAt: assignee.updatedAt || lead.updatedAt,
      });
      if (lead.updatedAt > report.lastActivityAt) {
        report.lastActivityAt = lead.updatedAt;
      }
    }
  }

  const { statusCounts } = await getStatusCountsForUserActivityPeriod(
    userId,
    period,
    customFilter,
  );

  return {
    user: report.user,
    totalActivities: report.totalActivities,
    totalLeadsWorkedOn: report.leadsWorkedOn.size,
    totalNotes: report.notesCount,
    totalReminders: report.remindersCount,
    leads: Array.from(report.leadsWorkedOn.entries()).map(([id, name]) => ({
      id,
      name,
    })),
    statusChangeHistory: report.statusChangeHistory,
    statusCounts,
    lastActivityAt: report.lastActivityAt,
  };
};
