    import cron from "node-cron";
    import { Op } from "sequelize";
    import Note from "../models/note.model";
    import User from "../models/user.model"; // Assuming you have this
    import { sendNotification } from "../services/notification.service";
    import { sendEmail } from "../utils/email"; // path to your sendEmail function

    const SMTP_CONFIG = {
    host: process.env.DEFAULT_SMTP_HOST || "smtp.example.com",
    port: parseInt(process.env.DEFAULT_SMTP_PORT || "587", 10),
    user: process.env.DEFAULT_SMTP_EMAIL || "engrshahidullah02@gmail.com",
    pass: process.env.DEFAULT_SMTP_PASSWORD || "idcn eevf qdxv muad",
    };

    cron.schedule("* * * * *", async () => {
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
console.log("🔎 Found due reminders:", dueReminders.map(r => ({
  id: r.id,
  reminderDate: r.reminderDate,
  now,
  oneMinuteAgo,
})));
    for (const reminder of dueReminders) {
        const message = `⏰ Reminder: ${reminder.content}`;

        if (reminder.createdBy) {
        // Send in-app notification
        await sendNotification(reminder.createdBy, message);

        // Fetch email of user who created this reminder
        const user = await User.findByPk(reminder.createdBy);
        if (user?.email) {
            await sendEmail({
            smtp: SMTP_CONFIG,
            to: user.email,
            subject: "CRM Reminder Notification",
            body: message,
            });
        }
        }
    }
    });
