// utils/emailService.ts
import formData from "form-data";
import Mailgun from "mailgun.js";
import { canSendEmail } from "./emailPermission";

const mailgun = new Mailgun(formData);
const mg = mailgun.client({
  username: "api",
  key: process.env.MAILGUN_API_KEY!,
});

export const sendEmail = async (
  to: string,
  subject: string,
  text: string,
  service: string
) => {
  const isAllowed = await canSendEmail(service);
  if (!isAllowed) {
    console.log(`Email not sent. Blocked by EmailRule for service: ${service}`);
    return;
  }

  await mg.messages.create(process.env.MAILGUN_DOMAIN!, {
    from: "Your App <noreply@yourdomain.com>",
    to,
    subject,
    text,
  });
};
