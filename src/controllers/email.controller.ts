import { Request, Response } from "express";
import { getCompiledTemplate } from "../services/template.service";
import { checkEmailPermission } from "../services/email.service";
import { emailQueue } from "../queue/emailQueue";
import User from "../models/user.model";
import { getSmtpConfig } from "../utils/getSmtpConfig";

export const sendBulkEmail = async (req: Request, res: Response) => {
  const { serviceName, recipients, subjectOverride, bodyOverride } = req.body;

  try {
    for (const recipient of recipients) {
      const { email, data } = recipient;

      // 1. Find user by email
      const user = await User.findOne({ where: { email } });
      if (!user || !user.id) continue; // ✅ skip if user not found or id missing

      // 2. Check permission
      const allowed = await checkEmailPermission(serviceName, user.userrole || "client");
      if (!allowed) continue;

      // 3. Get SMTP config (user or fallback)
      const smtpConfig = await getSmtpConfig(user.id);

      // 4. Render dynamic template
      const { subject, body } = await getCompiledTemplate(
        serviceName,
        data,
        subjectOverride,
        bodyOverride
      );

      // 5. Queue the email
      await emailQueue.add(serviceName, {
        to: email,
        subject,
        body,
        smtpConfig,
        serviceName,
      });
    }

    res.status(200).json({ message: "Emails queued successfully." });
  } catch (err) {
    console.error("Email send error:", err);
    res.status(500).json({ error: "Failed to queue emails." });
  }
};
