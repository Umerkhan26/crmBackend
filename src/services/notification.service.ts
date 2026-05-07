
import Notification from "../models/notification.model";

const userSocketRoom = (userId: number | string) =>
  `user_${String(userId).trim()}`;

/** Realtime only (no DB row). Useful when the client listens on a dedicated channel. */
export const emitSocketToUser = (
  userId: number,
  eventName: string,
  payload: Record<string, unknown>,
) => {
  if (!global.io) return;
  global.io.to(userSocketRoom(userId)).emit(eventName, payload);
};

export const sendNotification = async (
  userId: number,
  message: string,
  userName?: string,
  socketExtra?: Record<string, unknown>,
) => {
  const notification = await Notification.create({
    userId,
    userName: userName || null,
    message,
    isRead: false,
    created_at: new Date(),
  });

  if (global.io) {
    const room = userSocketRoom(userId);
    global.io.to(room).emit("notification", {
      message,
      userName: userName ?? null,
      ...(socketExtra || {}),
    });
  }

  return notification;
};
