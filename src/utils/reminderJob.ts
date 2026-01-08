
import cron from "node-cron";
import { Op } from "sequelize";
import Note from "../models/note.model";
import User from "../models/user.model";
import { sendNotification } from "../services/notification.service";
import { sendEmail } from "../utils/email";
import { reminderEmailTemplate } from "../Templetes/reminderEmailTemplate";

const SMTP_CONFIG = {
  host: process.env.DEFAULT_SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.DEFAULT_SMTP_PORT || "587", 10),
  user: process.env.DEFAULT_SMTP_EMAIL || "engrshahidullah02@gmail.com",
  pass: process.env.DEFAULT_SMTP_PASSWORD || "idcn eevf qdxv muad",
};

cron.schedule("* * * * *", async () => {
  try {
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);

    const dueReminders = await Note.findAll({
      where: {
        type: "reminder",
        reminderDate: {
          [Op.between]: [oneMinuteAgo, now],
        },
      },
    });

    if (!dueReminders.length) {
      return;
    }

    for (const reminder of dueReminders) {
      const message = `⏰ Reminder: ${reminder.content}`;

      if (reminder.createdBy) {
        await sendNotification(reminder.createdBy, message);

        const user = await User.findByPk(reminder.createdBy);
        if (user?.email) {
          const { subject, html } = reminderEmailTemplate(reminder.content, reminder.reminderDate?.toISOString());

          await sendEmail({
            smtp: SMTP_CONFIG,
            to: user.email,
            subject,
            body: html,
          });

        }
        else {
        }
      }
    }
  } catch (err) {
  }
});
