import express from "express";
import {
  addNote,
  addReminder,
  getNotes,
  getReminders,
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
  "/getNotes/:type/:id", // e.g., /lead/5 or /client_lead/10
  verifyToken,
  checkPermission(PERMISSIONS.NOTE_VIEW),
  getNotes
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

export default router;
