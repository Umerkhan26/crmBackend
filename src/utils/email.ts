
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

interface SendEmailOptions {
  smtp?: {
    host?: string;
    port?: number | string;
    user?: string;
    pass?: string;
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
    await transporter.sendMail({
      from: `"CRM App" <${user}>`,
      to,
      subject,
      text: body,
      html: body.replace(/\n/g, "<br>"),
    });
  } catch (error) {
  }
};
