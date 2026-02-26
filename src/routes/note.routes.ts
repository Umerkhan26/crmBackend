import express from "express";
import {
  addNote,
  addReminder,
  getNotes,
  getAllNotes,
  getRecentNotes,
  getReminders,
  getUpcomingReminders,
  updateNote,
  deleteNote,
  updateReminder,
  deleteReminder,
} from "../controllers/note.controller";
import { verifyToken } from "../middleware/verifyToken.middleware";
import { checkPermission } from "../middleware/checkPermission";
import { PERMISSIONS } from "../constants/permissions";

const router = express.Router();

router.post(
  "/add",
  verifyToken,
  checkPermission(PERMISSIONS.NOTE_CREATE),
  addNote
);

router.get(
  "/getNotes/:type/:id",
  verifyToken,
  checkPermission(PERMISSIONS.NOTE_VIEW),
  getNotes
);

router.get(
  "/getAllNotes",
  verifyToken,
  checkPermission(PERMISSIONS.NOTE_VIEW),
  getAllNotes
);

router.get(
  "/notes/recent",
  verifyToken,
  checkPermission(PERMISSIONS.NOTE_VIEW),
  getRecentNotes
);

router.put(
  "/update/:id",
  verifyToken,
  checkPermission(PERMISSIONS.NOTE_UPDATE),
  updateNote
);

router.delete(
  "/delete/:id",
  verifyToken,
  checkPermission(PERMISSIONS.NOTE_DELETE),
  deleteNote
);

router.post(
  "/addReminder",
  verifyToken,
  checkPermission(PERMISSIONS.REMINDER_CREATE),
  addReminder
);

router.get(
  "/getReminders/:type/:id",
  verifyToken,
  checkPermission(PERMISSIONS.REMINDER_VIEW),
  getReminders
);

router.get(
  "/upcomingReminders",
  verifyToken,
  checkPermission(PERMISSIONS.REMINDER_VIEW),
  getUpcomingReminders
);

router.put(
  "/updateReminder/:id",
  verifyToken,
  checkPermission(PERMISSIONS.REMINDER_UPDATE),
  updateReminder
);

router.delete(
  "/deleteReminder/:id",
  verifyToken,
  checkPermission(PERMISSIONS.REMINDER_DELETE),
  deleteReminder
);

export default router;
