import { Router, Request, Response } from "express";
import {
  recordEmailOpenByToken,
  TRACKING_PIXEL_GIF,
} from "../services/emailOpenTracking.service";

const router = Router();

const sendPixel = (res: Response) => {
  res.setHeader("Content-Type", "image/gif");
  res.setHeader("Content-Length", String(TRACKING_PIXEL_GIF.length));
  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate"
  );
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.status(200).send(TRACKING_PIXEL_GIF);
};

/**
 * Public open-tracking pixel (no auth).
 * GET /api/email-track/open/:token.gif
 */
router.get("/open/:token", async (req: Request, res: Response) => {
  try {
    const token = String(req.params.token || "");
    await recordEmailOpenByToken(token, {
      referer: String(req.get("referer") || req.get("referrer") || ""),
      origin: String(req.get("origin") || ""),
      userAgent: String(req.get("user-agent") || ""),
    });
  } catch (err) {
    console.warn(
      "[email-track] open record failed:",
      (err as Error)?.message || err
    );
  }
  sendPixel(res);
});

export default router;
