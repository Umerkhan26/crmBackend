
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
  replyTo?: string;
  /** When true, never fall back to DEFAULT_SMTP — customer portal emails only. */
  strict?: boolean;
  to: string;
  subject: string;
  body: string;
  attachments?: Array<{
    filename: string;
    path: string;
    cid: string;
  }>;
}

export const sendEmail = async ({
  smtp,
  replyTo,
  strict = false,
  to,
  subject,
  body,
  attachments,
}: SendEmailOptions): Promise<void> => {
  if (strict) {
    const host = smtp?.host?.trim();
    const user = smtp?.user?.trim();
    const pass = smtp?.pass?.trim();
    if (!host || !user || !pass) {
      throw new Error(
        "Customer portal SMTP is not configured. Set CUSTOMER_PORTAL_SMTP_PASSWORD (and related vars) in .env"
      );
    }
  }

  const host =
    smtp?.host?.trim() ||
    (!strict ? process.env.DEFAULT_SMTP_HOST || "smtp.gmail.com" : "");
  const port = Number(smtp?.port) || Number(process.env.DEFAULT_SMTP_PORT) || 587;
  const user =
    smtp?.user?.trim() || (!strict ? process.env.DEFAULT_SMTP_EMAIL : "");
  const pass =
    smtp?.pass?.trim() || (!strict ? process.env.DEFAULT_SMTP_PASSWORD : "");
  const fromName = smtp?.fromName?.trim() || "CRM App";

  if (strict && (!host || !user || !pass)) {
    throw new Error("Customer portal SMTP configuration is incomplete.");
  }

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
    const isHTML = /<[a-z][\s\S]*>/i.test(body);
    const textBody = isHTML ? body.replace(/<[^>]*>/g, "") : body;

    await transporter.sendMail({
      from: `"${fromName}" <${user}>`,
      replyTo: replyTo?.trim() || user,
      to,
      subject,
      text: textBody,
      html: isHTML ? body : body.replace(/\n/g, "<br>"),
      attachments: attachments?.map((file) => ({
        filename: file.filename,
        path: file.path,
        cid: file.cid,
      })),
      headers: {
        "X-Auto-Response-Suppress": "OOF, AutoReply",
        Precedence: "auto",
      },
    });
  } catch (error) {
    throw error;
  }
};
