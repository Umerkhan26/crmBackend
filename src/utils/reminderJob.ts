import cron from "node-cron";
import { Op } from "sequelize";
import Note from "../models/note.model";
import User from "../models/user.model";
import { sendNotification } from "../services/notification.service";
import { sendEmail } from "../utils/email";

// ✅ SMTP Config
const SMTP_CONFIG = {
  host: process.env.DEFAULT_SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.DEFAULT_SMTP_PORT || "587", 10),
  user: process.env.DEFAULT_SMTP_EMAIL || "engrshahidullah02@gmail.com",
  pass: process.env.DEFAULT_SMTP_PASSWORD || "idcn eevf qdxv muad",
};

// ✅ Run every minute
cron.schedule("* * * * *", async () => {
  try {
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);

    // console.log("⏰ Checking reminders between:", oneMinuteAgo, "→", now);

    // ✅ Fetch all due reminders
    const dueReminders = await Note.findAll({
      where: {
        type: "reminder",
        reminderDate: {
          [Op.between]: [oneMinuteAgo, now],
        },
      },
    });

    if (!dueReminders.length) {
      console.log("🔸 No reminders found for this minute.");
      return;
    }

  

    for (const reminder of dueReminders) {
      const message = `⏰ Reminder: ${reminder.content}`;

      // ✅ Send in-app notification
      if (reminder.createdBy) {
        await sendNotification(reminder.createdBy, message);

        // ✅ Send email to creator if available
        const user = await User.findByPk(reminder.createdBy);
        if (user?.email) {
          await sendEmail({
            smtp: SMTP_CONFIG,
            to: user.email,
            subject: "CRM Reminder Notification",
            body: message,
          });
          console.log(`📧 Email sent to ${user.email} for reminder ID ${reminder.id}`);
        } else {
          console.log(`⚠️ No email found for user ID ${reminder.createdBy}`);
        }
      }
    }
  } catch (err) {
    console.error("❌ Error in reminder cron job:", err);
  }
});
