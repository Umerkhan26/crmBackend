import { Request, Response } from "express";
import multer from "multer";
import * as CallService from "../services/call.service";
import { transcribeAudio } from "../services/stt.service";

const storage = multer.memoryStorage();
export const audioUpload = multer({
  storage,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB (keep safe for Whisper API limits)
    files: 1,
  },
});

export const transcribeCallAudioController = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const userId = (req as any).user?.id as number | undefined;
    if (!userId) {
      return res.status(401).json({ success: false, message: "User not authenticated" });
    }

    const callId = Number(req.params.id);
    if (!Number.isFinite(callId) || callId <= 0) {
      return res.status(400).json({ success: false, message: "Invalid call id" });
    }

    const file = (req as any).file as Express.Multer.File | undefined;
    if (!file?.buffer) {
      return res.status(400).json({ success: false, message: "audio file is required (field: audio)" });
    }

    // Ensure call exists and belongs to user
    const call = await CallService.getCallById(userId, callId);
    if (!call) {
      return res.status(404).json({ success: false, message: "Call not found" });
    }

    // Basic consent enforcement: require either existing consent on call or explicit override in request.
    const consent = Boolean((req.body && (req.body.consent === true || req.body.consent === "true")) || (call as any).consent);
    if (!consent) {
      return res.status(400).json({
        success: false,
        message: "Consent is required for transcription",
      });
    }

    const language = req.body?.language ? String(req.body.language) : undefined;

    const result = await transcribeAudio({
      audioBuffer: file.buffer,
      filename: file.originalname || "call.webm",
      mimeType: file.mimetype,
      language,
    });

    const sttProvider = process.env.USE_OPENAI_WHISPER === "true" 
      ? "openai_whisper_api" 
      : "self_hosted_whisper";

    const updated = await CallService.updateTranscript(userId, callId, {
      transcript: result.text,
      sttProvider,
      metadata: {
        transcription: {
          mimeType: file.mimetype,
          size: file.size,
          model: process.env.WHISPER_MODEL || "base",
        },
      },
    });

    return res.status(200).json({
      success: true,
      message: "Transcription completed",
      transcript: result.text,
      data: updated,
    });
  } catch (error: any) {
    const msg = error.message || "Failed to transcribe audio";
    const status = msg.includes("OPENAI_API_KEY") || msg.includes("Whisper") ? 501 : 500;
    return res.status(status).json({ success: false, message: msg });
  }
};

