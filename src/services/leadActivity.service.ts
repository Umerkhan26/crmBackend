// src/services/leadActivity.service.ts

import LeadActivity from "../models/leadActivity.model";
import User from "../models/user.model";
import Lead from "../models/lead.model";
import { getPagination, getPagingData } from "../utils/paginate";
import { Op, Sequelize, WhereOptions } from "sequelize";
import Note from "../models/note.model";
import ActivityLog from "../models/activityLog.model";
interface ReportUser {
  user: any;
  totalActivities: number;
  leadsWorkedOn: Map<string, string>; // ✅ key changed to string
  lastActivityAt: Date;
  notesCount: number;
  remindersCount: number;
  statusChangeHistory?: any[]; // ✅ add this line

}

// 🔹 Get activities for a specific lead (entityType = "lead")
export const getLeadActivitiesByLeadId = async (
  leadId: number,
  page: number = 1,
  limit: number = 10
) => {
  const { offset } = getPagination({ page, limit });

  // Use findAndCountAll for pagination
  const data = await LeadActivity.findAndCountAll({
    where: { entityId: leadId, entityType: "lead" }, // ✅ updated
    order: [["createdAt", "DESC"]],
    limit,
    offset,
    include: [
      {
        model: User,
        as: "performedByUser", // alias must match association in model setup
        attributes: { exclude: ["password"] },
      },
      {
        model: Lead,
        as: "LeadById",
        attributes: { exclude: [] },
      },
    ],
  });

  // Format response with pagination data
  return getPagingData(data, page, limit);
};

// 🔹 You could also add a generic fetcher (works for clientLead too)

// ✅ Get activities by entityId and entityType with pagination
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

// ✅ Get all lead activities with pagination
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


  await activity.destroy(); // Soft delete because of `paranoid: true`
  return { message: "Lead activity deleted and logged" };
};


// export const getLeadActivityReportByUser = async (
//   userId: number,
//   period: "daily" | "weekly" | "monthly"
// ) => {
//   let startDate: Date;
//   const endDate = new Date();

//   // 📅 Define date range
//   if (period === "daily") {
//     startDate = new Date();
//     startDate.setHours(0, 0, 0, 0);
//   } else if (period === "weekly") {
//     startDate = new Date();
//     startDate.setDate(startDate.getDate() - 7);
//   } else {
//     startDate = new Date();
//     startDate.setMonth(startDate.getMonth() - 1);
//   }

//   // 🟢 Fetch activities
//   const activities = await LeadActivity.findAll({
//     where: {
//       entityType: { [Op.in]: ["lead", "lead_status", "status_change"] },
//       createdAt: { [Op.between]: [startDate, endDate] },
//       performedBy: userId,
//     },
//     include: [
//       {
//         model: User,
//         as: "performedByUser",
//         attributes: ["id", "firstname", "email"],
//       },
//       { model: Lead, as: "LeadById" },
//     ],
//     order: [["createdAt", "DESC"]],
//   });

//   // 🟣 Fetch notes
//   const notes = await Note.findAll({
//     where: {
//       notebleType: "lead",
//       createdAt: { [Op.between]: [startDate, endDate] },
//       createdBy: userId,
//     },
//     include: [
//       {
//         model: User,
//         as: "creator",
//         attributes: ["id", "firstname", "email"],
//       },
//     ],
//   });

//   // 🟠 Fetch leads where this user changed status recently
//   const statusUpdates = await Lead.findAll({
//     where: Sequelize.literal(
//       `JSON_CONTAINS(assignees, JSON_OBJECT('userId', ${userId}))`
//     ),
//   });

//   const report: ReportUser = {
//     user:
//       activities[0]?.performedByUser ||
//       notes[0]?.creator || { id: userId, name: "Unknown User" },
//     totalActivities: 0,
//     leadsWorkedOn: new Map(),
//     lastActivityAt: startDate,
//     notesCount: 0,
//     remindersCount: 0,
//     statusChangeHistory: [], // ✅ new field
//   };

//   // 🟢 Process activities
//   for (const act of activities) {
//     report.totalActivities++;
//     const leadName =
//       act.Lead?.leadData?.name ||
//       act.Lead?.leadData?.fullName ||
//       `Lead #${act.Lead?.id}`;

//     if (act.Lead?.id) {
//       report.leadsWorkedOn.set(act.Lead.id, leadName);
//     }
//     if (act.createdAt > report.lastActivityAt) {
//       report.lastActivityAt = act.createdAt;
//     }
//   }

//   // 🟣 Process notes
//   for (const note of notes) {
//     if (note.type === "comment") report.notesCount++;
//     if (note.type === "reminder") report.remindersCount++;
//     report.leadsWorkedOn.set(note.notebleId, `Lead #${note.notebleId}`);
//     if (note.createdAt > report.lastActivityAt) {
//       report.lastActivityAt = note.createdAt;
//     }
//   }

//   // 🟠 Process direct status changes
//   for (const lead of statusUpdates) {
//     let assignees: any[] = [];
//     try {
//       assignees =
//         typeof lead.assignees === "string"
//           ? JSON.parse(lead.assignees)
//           : Array.isArray(lead.assignees)
//           ? lead.assignees
//           : [];
//     } catch {
//       assignees = [];
//     }

//     const assignee = assignees.find((a: any) => a.userId === userId);
//     if (assignee) {
//       const leadName =
//         lead.leadData?.name || lead.leadData?.fullName || `Lead #${lead.id}`;
//       report.leadsWorkedOn.set(lead.id, leadName);
//       report.totalActivities++;

//       report.statusChangeHistory?.push({
//   leadId: lead.id,
//   leadName,
//   newStatus: assignee.status,
//   changedAt: assignee.updatedAt || lead.updatedAt,
// });


//       if (lead.updatedAt > report.lastActivityAt) {
//         report.lastActivityAt = lead.updatedAt;
//       }
//     }
//   }

//   // 🧾 Final output
//   return {
//     user: report.user,
//     totalActivities: report.totalActivities,
//     totalLeadsWorkedOn: report.leadsWorkedOn.size,
//     totalNotes: report.notesCount,
//     totalReminders: report.remindersCount,
//     leads: Array.from(report.leadsWorkedOn.entries()).map(([id, name]) => ({
//       id,
//       name,
//     })),
//     statusChangeHistory: report.statusChangeHistory, // ✅ included in response
//     lastActivityAt: report.lastActivityAt,
//   };
// };


export const getLeadActivityReportByUser = async (
  userId: number,
  period: "daily" | "weekly" | "monthly" | "custom",
  customFilter: Record<string, any> = {} // :white_check_mark: optional filter
) => {
  let startDate: Date;
  let endDate: Date;
  // :date: Check if custom dates are provided
  const hasCustomDates = customFilter.startDate && customFilter.endDate;
  if (hasCustomDates) {
    // :white_check_mark: Use custom date range from filters
    startDate = new Date(customFilter.startDate);
    endDate = new Date(customFilter.endDate);
    // Remove startDate and endDate from customFilter so they don't override createdAt
    const { startDate: _, endDate: __, ...cleanCustomFilter } = customFilter;
    customFilter = cleanCustomFilter;
  } else {
    // :date: Use period-based date range
    endDate = new Date();
    if (period === "daily") {
      // :white_check_mark: From start of today to end of today (local time)
      startDate = new Date();
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
    } else if (period === "weekly") {
      // :white_check_mark: From 7 days ago (start of day) to end of today
      startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
    } else {
      // :white_check_mark: From 1 month ago (start of day) to end of today
      startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 1);
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
    }
  }
  console.log(":date: Date Range:", { startDate, endDate, hasCustomDates });
  // :large_green_circle: Fetch activities
  const activities = await LeadActivity.findAll({
    where: {
      entityType: { [Op.in]: ["lead", "lead_status", "status_change"] },
      createdAt: { [Op.between]: [startDate, endDate] },
      performedBy: userId,
      ...customFilter, // :white_check_mark: clean custom filter applied (no date conflicts)
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
  // :large_purple_circle: Fetch notes
  const notes = await Note.findAll({
    where: {
      notebleType: "lead",
      createdAt: { [Op.between]: [startDate, endDate] },
      createdBy: userId,
      ...customFilter, // :white_check_mark: clean custom filter applied
    },
    include: [
      {
        model: User,
        as: "creator",
        attributes: ["id", "firstname", "email"],
      },
    ],
  });
  // :large_orange_circle: Fetch leads where this user changed status recently
  const statusUpdatesWhere: any = {
    ...customFilter, // :white_check_mark: clean custom filter applied
    [Op.and]: Sequelize.literal(
      `JSON_CONTAINS(assignees, JSON_OBJECT('userId', ${userId}))`
    ),
  };
  // Add date filtering for status updates if using custom dates
  if (hasCustomDates) {
    statusUpdatesWhere.updatedAt = { [Op.between]: [startDate, endDate] };
  }
  const statusUpdates = await Lead.findAll({
    where: statusUpdatesWhere,
  });
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
  // :large_green_circle: Process activities
  for (const act of activities) {
    report.totalActivities++;
    const leadName =
      act.Lead?.leadData?.name ||
      act.Lead?.leadData?.fullName ||
      `Lead #${act.Lead?.id}`;
    if (act.Lead?.id) {
      report.leadsWorkedOn.set(act.Lead.id, leadName);
    }
    if (act.createdAt > report.lastActivityAt) {
      report.lastActivityAt = act.createdAt;
    }
  }
  // :large_purple_circle: Process notes
  for (const note of notes) {
    if (note.type === "comment") report.notesCount++;
    if (note.type === "reminder") report.remindersCount++;
    report.leadsWorkedOn.set(String(note.notebleId), `Lead #${note.notebleId}`);
    if (note.createdAt > report.lastActivityAt) {
      report.lastActivityAt = note.createdAt;
    }
  }
  // :large_orange_circle: Process direct status changes
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
        lead.leadData?.name || lead.leadData?.fullName || `Lead #${lead.id}`;
      report.leadsWorkedOn.set(lead.id, leadName);
      report.totalActivities++;
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
  // :receipt: Final output
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
