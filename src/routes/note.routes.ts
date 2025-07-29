import express from "express";
import { addNote, getNotes } from "../controllers/note.controller";
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

export default router;
