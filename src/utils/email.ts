import nodemailer from "nodemailer";

interface SendEmailOptions {
  smtp: {
    host?: string;
    port: number;
    user?: string;
    pass?: string;
  };
  to?: string;
  subject: string;
  body: string;
}


export const sendEmail = async ({
  smtp,
  to,
  subject,
  body,
}: SendEmailOptions): Promise<void> => {
  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.port === 465, // true for 465, false for others
    auth: {
      user: smtp.user,
      pass: smtp.pass,
    },
  });

  await transporter.sendMail({
    from: `"CRM App" <${smtp.user}>`,
    to,
    subject,
    text: body,
    html: body.replace(/\n/g, "<br>"), // Optional: send HTML version
  });
};
