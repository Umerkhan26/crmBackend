// // services/note.service.ts
// import Note from "../models/note.model";
// import User from "../models/user.model";
// import { logLeadActivity } from "../utils/logLeadActivity";

// interface AddNoteParams {
//   content: string;
//   type: "comment" | "reminder";
//   notebleId: number;
//   notebleType: "lead" | "client_lead";
//   userId: number;
// }

// interface AddReminderParams {
//   content: string;
//   reminderDate?: Date;
//   reminderType?: string; // user-defined/custom type
//   notebleId: number;
//   notebleType: "lead" | "client_lead";
//   userId: number;
// }

// interface GetRemindersParams {
//   notebleId: number;
//   notebleType: "lead" | "client_lead";
// }

// export const addNote = async ({
//   content,
//   type,
//   notebleId,
//   notebleType,
//   userId,
// }: AddNoteParams) => {
//   const note = await Note.create({
//     content,
//     type,
//     notebleId,
//     notebleType,
//     createdBy: userId,
//   });

//   const fullNote = await Note.findByPk(note.id, {
//     include: [
//       { model: User, as: "creator", attributes: ["id", "firstname", "email"] },
//     ],
//   });

//   // ✅ Log only if note is for a lead
//   if (notebleType === "lead") {
//     await logLeadActivity({
//       entityId: notebleId,
//       entityType: "lead",
//       action: "note_added",
//       performedBy: userId,
//       details: `Note added: "${content}"`,
//     });
//   }

//   return fullNote;
// };

// interface GetNotesParams {
//   notebleId: number;
//   notebleType: "lead" | "client_lead";
// }

// export const getNotesForEntity = async ({
//   notebleId,
//   notebleType,
// }: GetNotesParams) => {
//   return Note.findAll({
//     where: { notebleId, notebleType },
//     include: [
//       { model: User, as: "creator", attributes: ["id", "firstname", "email"] },
//     ],
//     order: [["createdAt", "DESC"]],
//   });
// };

// export const addReminder = async ({
//   content,
//   reminderDate,
//   reminderType,
//   notebleId,
//   notebleType,
//   userId,
// }: AddReminderParams) => {
//   // === Safe parse of reminderDate ===
//   let parsedDate: Date | undefined = undefined;

//   if (reminderDate !== undefined && reminderDate !== null) {
//     if (reminderDate instanceof Date) {
//       parsedDate = reminderDate;
//     } else {
//       const tempDate = new Date(reminderDate);
//       if (!Number.isNaN(tempDate.getTime())) {
//         parsedDate = tempDate;
//       }
//     }
//   }

//   const reminder = await Note.create({
//     content,
//     type: "reminder",
//     notebleId,
//     notebleType,
//     createdBy: userId,
//     reminderDate: parsedDate, // ✅ undefined if not valid
//     reminderType,
//   });

//   const fullReminder = await Note.findByPk(reminder.id, {
//     include: [
//       { model: User, as: "creator", attributes: ["id", "firstname", "email"] },
//     ],
//   });

//   // ✅ Log only if reminder is for a lead
//   if (notebleType === "lead") {
//     let datePart = "";
//     if (parsedDate) {
//       datePart = ` (Date: ${parsedDate.toISOString().split("T")[0]})`;
//     }
//     await logLeadActivity({
//       entityId: notebleId,
//       entityType: "lead",
//       action: "reminder_added",
//       performedBy: userId,
//       details: `Reminder set: "${content}"${datePart}`,
//     });
//   }

//   return fullReminder;
// };

// export const getRemindersForEntity = async ({
//   notebleId,
//   notebleType,
// }: GetRemindersParams) => {
//   return Note.findAll({
//     where: {
//       notebleId,
//       notebleType,
//       type: "reminder", // filter only reminders
//     },
//     include: [
//       { model: User, as: "creator", attributes: ["id", "firstname", "email"] },
//     ],
//     order: [["createdAt", "DESC"]],
//   });
// };

// export const updateNote = async (
//   id: number,
//   data: Partial<Note>,
//   userId: number
// ) => {
//   const note = await Note.findByPk(id);
//   if (!note) throw new Error("Note not found");
//   if (note.type !== "comment") throw new Error("This is not a note");

//   await note.update(data);

//   if (note.notebleType === "lead") {
//     await logLeadActivity({
//       entityId: note.notebleId,
//       entityType: "lead",
//       action: "note_updated",
//       performedBy: userId,
//       details: `Note updated: "${note.content}"`,
//     });
//   }

//   return note;
// };

// // ✅ Delete a note
// export const deleteNote = async (id: number, userId: number) => {
//   const note = await Note.findByPk(id);
//   if (!note) throw new Error("Note not found");
//   if (note.type !== "comment") throw new Error("This is not a note");

//   await note.destroy();

//   if (note.notebleType === "lead") {
//     await logLeadActivity({
//       entityId: note.notebleId,
//       entityType: "lead",
//       action: "note_deleted",
//       performedBy: userId,
//       details: `Note deleted: "${note.content}"`,
//     });
//   }

//   return { message: "Note deleted successfully" };
// };

// // ✅ Update a reminder
// export const updateReminder = async (
//   id: number,
//   data: Partial<Note>,
//   userId: number
// ) => {
//   const reminder = await Note.findByPk(id);
//   if (!reminder) throw new Error("Reminder not found");
//   if (reminder.type !== "reminder") throw new Error("This is not a reminder");

//   await reminder.update(data);

//   if (reminder.notebleType === "lead") {
//     await logLeadActivity({
//       entityId: reminder.notebleId,
//       entityType: "lead",
//       action: "reminder_updated",
//       performedBy: userId,
//       details: `Reminder updated: "${reminder.content}"`,
//     });
//   }

//   return reminder;
// };

// // ✅ Delete a reminder
// export const deleteReminder = async (id: number, userId: number) => {
//   const reminder = await Note.findByPk(id);
//   if (!reminder) throw new Error("Reminder not found");
//   if (reminder.type !== "reminder") throw new Error("This is not a reminder");

//   await reminder.destroy();

//   if (reminder.notebleType === "lead") {
//     await logLeadActivity({
//       entityId: reminder.notebleId,
//       entityType: "lead",
//       action: "reminder_deleted",
//       performedBy: userId,
//       details: `Reminder deleted: "${reminder.content}"`,
//     });
//   }

//   return { message: "Reminder deleted successfully" };
// };



// services/note.service.ts
import Note from "../models/note.model";
import User from "../models/user.model";
import { logLeadActivity } from "../utils/logLeadActivity";

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

  const fullNote = await Note.findByPk(note.id, {
    include: [
      { model: User, as: "creator", attributes: ["id", "firstname", "email"] },
    ],
  });

  // ✅ Log for both lead and client_lead
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

  // ✅ Log for both lead and client_lead
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

export const updateNote = async (
  id: number,
  data: Partial<Note>,
  userId: number
) => {
  const note = await Note.findByPk(id);
  if (!note) throw new Error("Note not found");
  if (note.type !== "comment") throw new Error("This is not a note");

  await note.update(data);

  // ✅ Log for both lead and client_lead
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

  // ✅ Log for both lead and client_lead
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

  // ✅ Log for both lead and client_lead
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

  // ✅ Log for both lead and client_lead
  await logLeadActivity({
    entityId: reminder.notebleId,
    entityType: reminder.notebleType === "lead" ? "lead" : "clientLead",
    action: "reminder_deleted",
    performedBy: userId,
    details: `Reminder deleted: "${reminder.content}"`,
  });

  return { message: "Reminder deleted successfully" };
};
