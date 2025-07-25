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
    include: [{ model: User, as: "creator", attributes: ["id", "firstname", "email"] }],
  });
};

interface GetNotesParams {
  notebleId: number;
  notebleType: "lead" | "client_lead";
}

export const getNotesForEntity = async ({ notebleId, notebleType }: GetNotesParams) => {
  return Note.findAll({
    where: { notebleId, notebleType },
    include: [{ model: User, as: "creator", attributes: ["id", "firstname", "email"] }],
    order: [["createdAt", "DESC"]],
  });
};
