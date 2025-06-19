import { Router } from "express";
import { sendBulkEmail } from "../controllers/email.controller";

const router = Router();

router.post("/email/bulk", sendBulkEmail); // POST /api/email/bulk

export default router;
