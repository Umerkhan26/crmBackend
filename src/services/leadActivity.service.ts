// src/services/leadActivity.service.ts

import LeadActivity from "../models/leadActivity.model";
import User from "../models/user.model";
import Lead from "../models/lead.model";
import { getPagination, getPagingData } from "../utils/paginate";
import { Op } from "sequelize";
import Note from "../models/note.model";
interface ReportUser {
  user: any;
  totalActivities: number;
  leadsWorkedOn: Map<number, string>;
  lastActivityAt: Date;
  notesCount: number;
  remindersCount: number;
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

export const deleteLeadActivity = async (id: number) => {
  const activity = await LeadActivity.findByPk(id);
  if (!activity) {
    throw new Error("Lead activity not found");
  }
  await activity.destroy();
  return { message: "Lead activity deleted successfully" };
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

//   // 🟢 Fetch lead-related activities only for this user
//   const activities = await LeadActivity.findAll({
//     where: {
//       entityType: "lead",
//       createdAt: { [Op.between]: [startDate, endDate] },
//       performedBy: userId,
//     },
//     include: [
//       {
//         model: User,
//         as: "performedByUser",
//         attributes: ["id", "firstname", "email"],
//       },
//       {
//         model: Lead,
//         as: "LeadById", //       attributes: ["id", "leadData"],
//       },
//     ],
//     order: [["createdAt", "DESC"]],
//   });

//   // 🟣 Fetch notes only for this user
//   const notes = await Note.findAll({
//     where: {
//       notebleType: "lead",
//       createdAt: { [Op.between]: [startDate, endDate] },
//       createdBy: userId, // ✅ Filter by userId
//     },
//     include: [
//       {
//         model: User,
//         as: "creator",
//         attributes: ["id", "firstname", "email"],
//       },
//     ],
//   });

//   // 🔹 Prepare user-level report
//   const report: ReportUser = {
//     user: activities[0]?.performedByUser ||
//       notes[0]?.creator || { id: userId, name: "Unknown User" },
//     totalActivities: 0,
//     leadsWorkedOn: new Map(),
//     lastActivityAt: startDate,
//     notesCount: 0,
//     remindersCount: 0,
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

//   // 🟣 Process notes & reminders
//   for (const note of notes) {
//     if (note.type === "comment") report.notesCount++;
//     if (note.type === "reminder") report.remindersCount++;

//     report.leadsWorkedOn.set(note.notebleId, `Lead #${note.notebleId}`);

//     if (note.createdAt > report.lastActivityAt) {
//       report.lastActivityAt = note.createdAt;
//     }
//   }

//   // 🧾 Final formatted output
//   const formattedReport = {
//     user: report.user,
//     totalActivities: report.totalActivities,
//     totalLeadsWorkedOn: report.leadsWorkedOn.size,
//     totalNotes: report.notesCount,
//     totalReminders: report.remindersCount,
//     leads: Array.from(report.leadsWorkedOn.entries()).map(([id, name]) => ({
//       id,
//       name,
//     })),
//     lastActivityAt: report.lastActivityAt,
//   };

//   return formattedReport;
// };


export const getLeadActivityReportByUser = async (
  userId: number,
  period: "daily" | "weekly" | "monthly"
) => {
  let startDate: Date;
  const endDate = new Date();

  // 📅 Define date range
  if (period === "daily") {
    startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
  } else if (period === "weekly") {
    startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);
  } else {
    startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 1);
  }

  // 🟢 Fetch lead-related activities (including status changes)
  const activities = await LeadActivity.findAll({
    where: {
      entityType: { [Op.in]: ["lead", "lead_status", "status_change"] },
      createdAt: { [Op.between]: [startDate, endDate] },
      performedBy: userId,
    },
    include: [
      {
        model: User,
        as: "performedByUser",
        attributes: ["id", "firstname", "email"],
      },
      {
        model: Lead,
        as: "LeadById",
      },
    ],
    order: [["createdAt", "DESC"]],
  });

  // 🟣 Fetch notes only for this user
  const notes = await Note.findAll({
    where: {
      notebleType: "lead",
      createdAt: { [Op.between]: [startDate, endDate] },
      createdBy: userId,
    },
    include: [
      {
        model: User,
        as: "creator",
        attributes: ["id", "firstname", "email"],
      },
    ],
  });

  // 🟡 Fetch leads whose status was updated by this user within the time range
  // 🟡 Fetch leads whose status was updated by this user within the time range
  const statusUpdates = await Lead.findAll({
    where: {
      updatedAt: { [Op.between]: [startDate, endDate] },
      assignees: {
        [Op.contains]: [{ userId }],
      },
    } as any, // ✅ safely cast to any for Sequelize-managed fields
  });

  // 🔹 Prepare user-level report
  const report: ReportUser = {
    user:
      activities[0]?.performedByUser ||
      notes[0]?.creator || { id: userId, name: "Unknown User" },
    totalActivities: 0,
    leadsWorkedOn: new Map(),
    lastActivityAt: startDate,
    notesCount: 0,
    remindersCount: 0,
  };

  // 🟢 Process activities
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

  // 🟣 Process notes & reminders
  for (const note of notes) {
    if (note.type === "comment") report.notesCount++;
    if (note.type === "reminder") report.remindersCount++;

    report.leadsWorkedOn.set(note.notebleId, `Lead #${note.notebleId}`);

    if (note.createdAt > report.lastActivityAt) {
      report.lastActivityAt = note.createdAt;
    }
  }

  // 🟠 Process direct status updates from the Lead model
  for (const lead of statusUpdates) {
    const assignee = lead.assignees?.find((a: any) => a.userId === userId);
    if (assignee) {
      const leadName =
        lead.leadData?.name || lead.leadData?.fullName || `Lead #${lead.id}`;
      report.leadsWorkedOn.set(lead.id, leadName);
      report.totalActivities++; // count as an activity
      if (lead.updatedAt > report.lastActivityAt) {
        report.lastActivityAt = lead.updatedAt;
      }
    }
  }

  // 🧾 Final formatted output
  const formattedReport = {
    user: report.user,
    totalActivities: report.totalActivities,
    totalLeadsWorkedOn: report.leadsWorkedOn.size,
    totalNotes: report.notesCount,
    totalReminders: report.remindersCount,
    leads: Array.from(report.leadsWorkedOn.entries()).map(([id, name]) => ({
      id,
      name,
    })),
    lastActivityAt: report.lastActivityAt,
  };

  return formattedReport;
};
