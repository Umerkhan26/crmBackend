import express from "express";
import {
  getEmailTemplates,
  updateEmailTemplate,
} from "../controllers/emailTemplate.controller";

const router = express.Router();

router.get("/email-templates", getEmailTemplates);
router.put("/email-templates/:id", updateEmailTemplate);

export default router;
