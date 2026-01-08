import { Router } from "express";
import { sendBulkEmail } from "../controllers/email.controller";
import { sendCustomEmailController } from "../controllers/customEmail.controller";
import { verifyToken } from "../middleware/verifyToken.middleware";

const router = Router();

router.post("/email/bulk", sendBulkEmail);
router.post("/send-custom-email", verifyToken, sendCustomEmailController);

export default router;
