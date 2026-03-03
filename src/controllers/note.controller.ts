import { Request, Response } from "express";
import * as NoteService from "../services/note.service";

export const addNote = async (req: Request, res: Response): Promise<any> => {
  try {
    const { content, type, notebleId, notebleType } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res
        .status(401)
        .json({ message: "Unauthorized: user ID not found" });
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
      return res
        .status(400)
        .json({ message: "Invalid notebleId or notebleType" });
    }

    const notes = await NoteService.getNotesForEntity({
      notebleId,
      notebleType,
    });

    return res.status(200).json({ success: true, notes });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const addReminder = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const { content, reminderType, notebleId, notebleType, reminderDate } =
      req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res
        .status(401)
        .json({ message: "Unauthorized: user ID not found" });
    }

    if (
      !content ||
      !reminderType ||
      !notebleId ||
      !notebleType ||
      !reminderDate
    ) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const reminder = await NoteService.addReminder({
      content,
      reminderType,
      notebleId,
      notebleType,
      reminderDate,
      userId,
    });

    return res.status(201).json({ success: true, reminder });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getReminders = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const notebleId = parseInt(req.params.id, 10);
    const notebleType = req.params.type as "lead" | "client_lead";

    if (isNaN(notebleId) || !["lead", "client_lead"].includes(notebleType)) {
      return res
        .status(400)
        .json({ message: "Invalid notebleId or notebleType" });
    }

    const reminders = await NoteService.getRemindersForEntity({
      notebleId,
      notebleType,
    });

    return res.status(200).json({ success: true, reminders });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getUpcomingReminders = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res
        .status(401)
        .json({ success: false, message: "Unauthorized: user ID not found" });
    }

    const reminders = await NoteService.getUpcomingRemindersForUser(userId);

    return res.status(200).json({ success: true, reminders });
  } catch (error: any) {
    return res
      .status(500)
      .json({
        success: false,
        message: error.message || "Failed to fetch upcoming reminders",
      });
  }
};

export const updateNote = async (req: Request, res: Response): Promise<any> => {
  try {
    const noteId = parseInt(req.params.id, 10);
    const userId = req.user?.id;

    if (!userId) {
      return res
        .status(401)
        .json({ message: "Unauthorized: user ID not found" });
    }
    if (isNaN(noteId)) {
      return res.status(400).json({ message: "Invalid note ID" });
    }

    const updatedNote = await NoteService.updateNote(noteId, req.body, userId);

    return res.status(200).json({ success: true, note: updatedNote });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteNote = async (req: Request, res: Response): Promise<any> => {
  try {
    const noteId = parseInt(req.params.id, 10);
    const userId = req.user?.id;

    if (!userId) {
      return res
        .status(401)
        .json({ message: "Unauthorized: user ID not found" });
    }
    if (isNaN(noteId)) {
      return res.status(400).json({ message: "Invalid note ID" });
    }

    const result = await NoteService.deleteNote(noteId, userId);

    return res.status(200).json({ success: true, ...result });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateReminder = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const reminderId = parseInt(req.params.id, 10);
    const userId = req.user?.id;

    if (!userId) {
      return res
        .status(401)
        .json({ message: "Unauthorized: user ID not found" });
    }
    if (isNaN(reminderId)) {
      return res.status(400).json({ message: "Invalid reminder ID" });
    }

    const updatedReminder = await NoteService.updateReminder(
      reminderId,
      req.body,
      userId,
    );

    return res.status(200).json({ success: true, reminder: updatedReminder });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteReminder = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const reminderId = parseInt(req.params.id, 10);
    const userId = req.user?.id;

    if (!userId) {
      return res
        .status(401)
        .json({ message: "Unauthorized: user ID not found" });
    }
    if (isNaN(reminderId)) {
      return res.status(400).json({ message: "Invalid reminder ID" });
    }

    const result = await NoteService.deleteReminder(reminderId, userId);

    return res.status(200).json({ success: true, ...result });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getAllNotes = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: user ID not found",
      });
    }

    // Get user role to check if admin
    const User = (await import("../models/user.model")).default;
    const Role = (await import("../models/role.model")).default;

    const user = (await User.findByPk(userId, {
      include: {
        model: Role,
      },
    })) as any;

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const roleName = user.Role?.name?.toLowerCase() || "";
    const isAdmin = roleName === "admin" || roleName === "adminn";

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    const result = await NoteService.getAllNotesWithPagination(
      page,
      limit,
      userId,
      isAdmin,
    );

    return res.status(200).json({
      success: true,
      message: "Notes fetched successfully",
      ...result,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch notes",
    });
  }
};

export const getRecentNotes = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: user ID not found",
      });
    }

    const limit = req.query.limit
      ? parseInt(req.query.limit as string, 10)
      : 10;

    // Determine admin vs non-admin (same approach as getAllNotes)
    const User = (await import("../models/user.model")).default;
    const Role = (await import("../models/role.model")).default;

    const user = (await User.findByPk(userId, {
      include: { model: Role },
    })) as any;

    // const roleName = user?.Role?.name?.toLowerCase() || "";
    // const isAdmin = roleName === "admin" || roleName === "adminn";

    const roleName = (user?.Role?.name || "").toLowerCase().trim();
    const isAdmin =
      roleName === "admin" ||
      roleName === "adminn" ||
      roleName === "manager" ||
      (!!roleName && roleName.includes("manager"));

    const notes = await NoteService.getRecentNotesFast({
      limit,
      userId,
      isAdmin,
    });

    return res.status(200).json({
      success: true,
      message: "Recent notes fetched successfully",
      notes,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch recent notes",
    });
  }
};
