// services/note.service.ts
import Note from "../models/note.model";
import User from "../models/user.model";

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
  reminderType?: string; // user-defined/custom type
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

  return Note.findByPk(note.id, {
    include: [
      { model: User, as: "creator", attributes: ["id", "firstname", "email"] },
    ],
  });
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
  const reminder = await Note.create({
    content,
    type: "reminder",
    notebleId,
    notebleType,
    createdBy: userId,
    reminderDate,
    reminderType,
  });

  return Note.findByPk(reminder.id, {
    include: [
      { model: User, as: "creator", attributes: ["id", "firstname", "email"] },
    ],
  });
};



export const getRemindersForEntity = async ({
  notebleId,
  notebleType,
}: GetRemindersParams) => {
  return Note.findAll({
    where: {
      notebleId,
      notebleType,
      type: "reminder", // filter only reminders
    },
    include: [
      { model: User, as: "creator", attributes: ["id", "firstname", "email"] },
    ],
    order: [["createdAt", "DESC"]],
  });
};
