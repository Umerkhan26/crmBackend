
import Notification from "../models/notification.model";

export const sendNotification = async (
  userId: number,
  message: string,
  userName?: string
) => {
  const notification = await Notification.create({
    userId,
    userName: userName || null,
    message,
    isRead: false,
    created_at: new Date(),
  });

  if (global.io) {
    global.io.to(`user_${userId}`).emit("notification", { message, userName });
  }

  return notification;
};
