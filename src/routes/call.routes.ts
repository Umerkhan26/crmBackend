import { Router } from "express";
import { verifyToken } from "../middleware/verifyToken.middleware";
import * as CallController from "../controllers/call.controller";
import {
  audioUpload,
  transcribeCallAudioController,
} from "../controllers/transcription.controller";

const router = Router();

// These endpoints are intended for the Chrome Extension + CRM frontend.
// Auth: same JWT as the rest of the app (Authorization: Bearer <token>).
router.post("/calls/start", verifyToken, CallController.startCallController);
router.patch("/calls/:id/end", verifyToken, CallController.endCallController);
router.patch(
  "/calls/:id/transcript",
  verifyToken,
  CallController.updateTranscriptController
);
router.post(
  "/calls/:id/transcribe",
  verifyToken,
  audioUpload.single("audio"),
  transcribeCallAudioController
);
router.get("/calls/:id", verifyToken, CallController.getCallByIdController);
router.get("/calls", verifyToken, CallController.listCallsController);

export default router;

