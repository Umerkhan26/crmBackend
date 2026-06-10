
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

interface SendEmailOptions {
  smtp?: {
    host?: string;
    port?: number | string;
    user?: string;
    pass?: string;
    fromName?: string;
  };
  to: string;
  subject: string;
  body: string;
}

export const sendEmail = async ({
  smtp,
  to,
  subject,
  body,
}: SendEmailOptions): Promise<void> => {
  const host = smtp?.host || process.env.DEFAULT_SMTP_HOST || "smtp.gmail.com";
  const port = Number(smtp?.port) || Number(process.env.DEFAULT_SMTP_PORT) || 587;
  const user = smtp?.user || process.env.DEFAULT_SMTP_EMAIL;
  const pass = smtp?.pass || process.env.DEFAULT_SMTP_PASSWORD;
  const fromName = smtp?.fromName?.trim() || "CRM App";

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    tls: {
      rejectUnauthorized: false,
    },
  });

  try {
    // Check if body is already HTML (contains HTML tags)
    const isHTML = /<[a-z][\s\S]*>/i.test(body);
    
    await transporter.sendMail({
      from: `"${fromName}" <${user}>`,
      to,
      subject,
      text: isHTML ? body.replace(/<[^>]*>/g, '') : body, // Strip HTML for text version
      html: isHTML ? body : body.replace(/\n/g, "<br>"), // Use as-is if HTML, otherwise convert newlines
    });
  } catch (error) {
    throw error;
  }
};
