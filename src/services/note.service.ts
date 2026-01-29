

import Note from "../models/note.model";
import User from "../models/user.model";
import { logLeadActivity } from "../utils/logLeadActivity";
import { Op } from "sequelize";

interface AddNoteParams {
  content: string;
  type: "comment" | "reminder";
  notebleId: number;
  notebleType: "lead" | "client_lead";
  userId: number;
}

interface AddReminderParams {
  content: string;
  reminderDate?: Date;
  reminderType?: string;
  notebleId: number;
  notebleType: "lead" | "client_lead";
  userId: number;
}

interface GetRemindersParams {
  notebleId: number;
  notebleType: "lead" | "client_lead";
}

export const addNote = async ({
  content,
  type,
  notebleId,
  notebleType,
  userId,
}: AddNoteParams) => {
  const note = await Note.create({
    content,
    type,
    notebleId,
    notebleType,
    createdBy: userId,
  });

  const fullNote = await Note.findByPk(note.id, {
    include: [
      { model: User, as: "creator", attributes: ["id", "firstname", "email"] },
    ],
  });

  await logLeadActivity({
    entityId: notebleId,
    entityType: notebleType === "lead" ? "lead" : "clientLead",
    action: "note_added",
    performedBy: userId,
    details: `Note added: "${content}"`,
  });

  return fullNote;
};

interface GetNotesParams {
  notebleId: number;
  notebleType: "lead" | "client_lead";
}

export const getNotesForEntity = async ({
  notebleId,
  notebleType,
}: GetNotesParams) => {
  return Note.findAll({
    where: { notebleId, notebleType },
    include: [
      { model: User, as: "creator", attributes: ["id", "firstname", "email"] },
    ],
    order: [["createdAt", "DESC"]],
  });
};

export const addReminder = async ({
  content,
  reminderDate,
  reminderType,
  notebleId,
  notebleType,
  userId,
}: AddReminderParams) => {
  let parsedDate: Date | undefined = undefined;

  if (reminderDate !== undefined && reminderDate !== null) {
    if (reminderDate instanceof Date) {
      parsedDate = reminderDate;
    } else {
      const tempDate = new Date(reminderDate);
      if (!Number.isNaN(tempDate.getTime())) {
        parsedDate = tempDate;
      }
    }
  }

  const reminder = await Note.create({
    content,
    type: "reminder",
    notebleId,
    notebleType,
    createdBy: userId,
    reminderDate: parsedDate,
    reminderType,
  });

  const fullReminder = await Note.findByPk(reminder.id, {
    include: [
      { model: User, as: "creator", attributes: ["id", "firstname", "email"] },
    ],
  });

  let datePart = "";
  if (parsedDate) {
    datePart = ` (Date: ${parsedDate.toISOString().split("T")[0]})`;
  }
  await logLeadActivity({
    entityId: notebleId,
    entityType: notebleType === "lead" ? "lead" : "clientLead",
    action: "reminder_added",
    performedBy: userId,
    details: `Reminder set: "${content}"${datePart}`,
  });

  return fullReminder;
};

export const getRemindersForEntity = async ({
  notebleId,
  notebleType,
}: GetRemindersParams) => {
  return Note.findAll({
    where: {
      notebleId,
      notebleType,
      type: "reminder",
    },
    include: [
      { model: User, as: "creator", attributes: ["id", "firstname", "email"] },
    ],
    order: [["createdAt", "DESC"]],
  });
};

/**
 * Get upcoming reminders for a user within the next N minutes.
 * Used for in-app popup notifications.
 */
export const getUpcomingRemindersForUser = async (
  userId: number,
  windowMinutes: number = 10
) => {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + windowMinutes * 60 * 1000);

  return Note.findAll({
    where: {
      type: "reminder",
      createdBy: userId,
      reminderDate: {
        [Op.between]: [now, windowEnd],
      },
    },
    include: [
      { model: User, as: "creator", attributes: ["id", "firstname", "email"] },
    ],
    order: [["reminderDate", "ASC"]],
  });
};

export const updateNote = async (
  id: number,
  data: Partial<Note>,
  userId: number
) => {
  const note = await Note.findByPk(id);
  if (!note) throw new Error("Note not found");
  if (note.type !== "comment") throw new Error("This is not a note");

  await note.update(data);

  await logLeadActivity({
    entityId: note.notebleId,
    entityType: note.notebleType === "lead" ? "lead" : "clientLead",
    action: "note_updated",
    performedBy: userId,
    details: `Note updated: "${note.content}"`,
  });

  return note;
};

export const deleteNote = async (id: number, userId: number) => {
  const note = await Note.findByPk(id);
  if (!note) throw new Error("Note not found");
  if (note.type !== "comment") throw new Error("This is not a note");

  await note.destroy();

  await logLeadActivity({
    entityId: note.notebleId,
    entityType: note.notebleType === "lead" ? "lead" : "clientLead",
    action: "note_deleted",
    performedBy: userId,
    details: `Note deleted: "${note.content}"`,
  });

  return { message: "Note deleted successfully" };
};

export const updateReminder = async (
  id: number,
  data: Partial<Note>,
  userId: number
) => {
  const reminder = await Note.findByPk(id);
  if (!reminder) throw new Error("Reminder not found");
  if (reminder.type !== "reminder") throw new Error("This is not a reminder");

  await reminder.update(data);

  await logLeadActivity({
    entityId: reminder.notebleId,
    entityType: reminder.notebleType === "lead" ? "lead" : "clientLead",
    action: "reminder_updated",
    performedBy: userId,
    details: `Reminder updated: "${reminder.content}"`,
  });

  return reminder;
};

export const deleteReminder = async (id: number, userId: number) => {
  const reminder = await Note.findByPk(id);
  if (!reminder) throw new Error("Reminder not found");
  if (reminder.type !== "reminder") throw new Error("This is not a reminder");

  await reminder.destroy();

  await logLeadActivity({
    entityId: reminder.notebleId,
    entityType: reminder.notebleType === "lead" ? "lead" : "clientLead",
    action: "reminder_deleted",
    performedBy: userId,
    details: `Reminder deleted: "${reminder.content}"`,
  });

  return { message: "Reminder deleted successfully" };
};
