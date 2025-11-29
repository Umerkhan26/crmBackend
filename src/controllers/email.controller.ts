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

      const user = await User.findOne({ where: { email } });
      if (!user || !user.id) continue;

      const allowed = await checkEmailPermission(serviceName, user.userrole || "client");
      if (!allowed) continue;

      const smtpConfig = await getSmtpConfig(user.id);

      const { subject, body } = await getCompiledTemplate(
        serviceName,
        data,
        subjectOverride,
        bodyOverride
      );

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
    res.status(500).json({ error: "Failed to queue emails." });
  }
};
