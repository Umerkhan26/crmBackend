// services/note.service.ts
import Note from "../models/note.model";
import User from "../models/user.model";

export const addNote = async ({
  content,
  type,
  notebleId,
  notebleType,
  userId,
}: {
  content: string;
  type: "comment" | "reminder";
  notebleId: number;
  notebleType: "lead" | "client_lead";
  userId: number;
}) => {
  return await Note.create({
    content,
    type,
    notebleId,
    notebleType,
    createdBy: userId,
  });
};

export const getNotesForEntity = async (
  notebleId: number,
  notebleType: "lead" | "client_lead"
) => {
  return await Note.findAll({
    where: { notebleId, notebleType },
    include: [{ model: User, as: "creator", attributes: ["id", "firstname", "email"] }],
    order: [["createdAt", "DESC"]],
  });
};
