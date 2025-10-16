// import nodemailer from "nodemailer";

// interface SendEmailOptions {
//   smtp: {
//     host?: string;
//     port: number;
//     user?: string;
//     pass?: string;
//   };
//   to?: string;
//   subject: string;
//   body: string;
// }


// export const sendEmail = async ({
//   smtp,
//   to,
//   subject,
//   body,
// }: SendEmailOptions): Promise<void> => {
//   const transporter = nodemailer.createTransport({
//     host: smtp.host,
//     port: smtp.port,
//     secure: smtp.port === 465, // true for 465, false for others
//     auth: {
//       user: smtp.user,
//       pass: smtp.pass,
//     },
//   });

//   await transporter.sendMail({
//     from: `"CRM App" <${smtp.user}>`,
//     to,
//     subject,
//     text: body,
//     html: body.replace(/\n/g, "<br>"), // Optional: send HTML version
//   });
// };


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
  // 🟢 Use user-provided SMTP if available, otherwise fallback to .env
  const host =
    smtp?.host || process.env.DEFAULT_SMTP_HOST || "smtp.gmail.com";
  const port =
    Number(smtp?.port) || Number(process.env.DEFAULT_SMTP_PORT) || 587;
  const user = smtp?.user || process.env.DEFAULT_SMTP_EMAIL;
  const pass = smtp?.pass || process.env.DEFAULT_SMTP_PASSWORD;

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // SSL for port 465
    auth: {
      user,
      pass,
    },
  });

  await transporter.sendMail({
    from: `"CRM App" <${user}>`,
    to,
    subject,
    text: body,
    html: body.replace(/\n/g, "<br>"), // optional: HTML version
  });
};
