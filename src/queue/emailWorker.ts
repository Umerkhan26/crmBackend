import { Worker } from "bullmq";
import { connection } from "./redisConnection";
import nodemailer from "nodemailer";
import { logEmailStatus } from "../services/emailLog.service";

new Worker("emailQueue", async job => {
  const { to, subject, body, smtpConfig, serviceName } = job.data;

  const transporter = nodemailer.createTransport({
    host: smtpConfig.host,
    port: smtpConfig.port,
    auth: {
      user: smtpConfig.user,
      pass: smtpConfig.pass,
    },
  });

  try {
    await transporter.sendMail({ from: smtpConfig.user, to, subject, html: body });
    await logEmailStatus({ to, subject, body, status: 'success', serviceName });
  } catch (err:any) {
    await logEmailStatus({ to, subject, body, status: 'failed', errorMsg: err.message, serviceName });
  }
}, { connection });
