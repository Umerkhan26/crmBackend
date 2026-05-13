
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
  limit: number = 10
) => {
  const { offset } = getPagination({ page, limit });

  const data = await LeadActivity.findAndCountAll({
    where: { entityId: leadId, entityType: "lead" },
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
        attributes: { exclude: [] },
      },
    ],
  });

  return getPagingData(data, page, limit);
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
    let assignees: any[] = [];
    try {
      assignees =
        typeof lead.assignees === "string"
          ? JSON.parse(lead.assignees)
          : Array.isArray(lead.assignees)
            ? lead.assignees
            : [];
    } catch {
      assignees = [];
    }
    const assignee = assignees.find((a: any) => a.userId === userId);
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
    lastActivityAt: report.lastActivityAt,
  };
};
