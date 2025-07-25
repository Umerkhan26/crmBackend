
// controllers/note.controller.ts
import { Request, Response } from "express";
import * as NoteService from "../services/note.service";

export const addNote = async (req: Request, res: Response) => {
  try {
    const { content, type, notebleId, notebleType } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized: user ID not found" });
    }

    if (!content || !notebleId || !notebleType || !type) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const note = await NoteService.addNote({
      content,
      type,
      notebleId,
      notebleType,
      userId, // ✅ Now TS knows it's definitely a number
    });

    res.status(201).json({ success: true, note });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
;

export const getNotes = async (req: Request, res: Response) => {
  try {
    const notebleId = parseInt(req.params.id, 10);
    const notebleType = req.params.type as "lead" | "client_lead";

    const notes = await NoteService.getNotesForEntity(notebleId, notebleType);
    res.status(200).json({ success: true, notes });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
