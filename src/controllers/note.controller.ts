// controllers/note.controller.ts
import { Request, Response } from "express";
import * as NoteService from "../services/note.service";

export const addNote = async (req: Request, res: Response): Promise<any> => {
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
      userId,
    });

    return res.status(201).json({ success: true, note });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getNotes = async (req: Request, res: Response): Promise<any> => {
  try {
    const notebleId = parseInt(req.params.id, 10);
    const notebleType = req.params.type as "lead" | "client_lead";

    if (isNaN(notebleId) || !["lead", "client_lead"].includes(notebleType)) {
      return res.status(400).json({ message: "Invalid notebleId or notebleType" });
    }

    const notes = await NoteService.getNotesForEntity({ notebleId, notebleType });

    return res.status(200).json({ success: true, notes });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
