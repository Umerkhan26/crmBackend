
import crypto from "crypto";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import { htmlToPlainText } from "./emailPlainText";

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
};

const buildMessageId = (smtpUser: string): string => {
  const domain = smtpUser.split("@")[1]?.trim() || "localhost";
  const unique = `${Date.now()}.${crypto.randomBytes(10).toString("hex")}`;
  return `<${unique}@${domain}>`;
};

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
    const textBody = isHTML ? htmlToPlainText(body) : body;

    const mailOptions: nodemailer.SendMailOptions = {
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
    };

    if (user) {
      mailOptions.messageId = buildMessageId(user);
    }

    if (strict) {
      // Transactional customer mail — no bulk Precedence header; aligned Message-ID above.
      mailOptions.headers = {
        "X-Auto-Response-Suppress": "OOF, AutoReply",
      };
    } else {
      mailOptions.headers = {
        "X-Auto-Response-Suppress": "OOF, AutoReply",
        Precedence: "auto",
      };
    }

    await transporter.sendMail(mailOptions);
  } catch (error) {
    throw error;
  }
};
