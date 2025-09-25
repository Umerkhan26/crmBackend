// controllers/notification.controller.ts
import { Request, Response } from "express";
import Notification from "../models/notification.model";
import { sendNotification } from "../services/notification.service";

export const sendNotificationController = async (
  req: Request,
  res: Response
) => {
  const { userId, message } = req.body;
  try {
    const notification = await sendNotification(userId, message);
    res.status(201).json(notification);
  } catch (error) {
    res.status(500).json({ message: "Failed to send notification", error });
  }
};

// controller
export const getUserNotificationsController = async (
  req: Request,
  res: Response
) => {
  const { userId } = req.params;
  const { page = 1, limit = 10 } = req.query;

  try {
    const offset = (Number(page) - 1) * Number(limit);

    const { rows: notifications, count } = await Notification.findAndCountAll({
      where: { userId },
      order: [["created_at", "DESC"]],
      limit: Number(limit),
      offset,
    });

    res.status(200).json({
      data: notifications,
      total: count,
      currentPage: Number(page),
      totalPages: Math.ceil(count / Number(limit)),
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch notifications", error });
  }
};

export const markNotificationsAsReadController = async (
  req: Request,
  res: Response
) => {
  const { userId } = req.params;
  try {
    await Notification.update({ isRead: true }, { where: { userId } });
    res.status(200).json({ message: "Notifications marked as read" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to mark notifications as read", error });
  }
};

export const getUnreadCountController = async (req: Request, res: Response) => {
  const { userId } = req.params;
  try {
    const count = await Notification.count({
      where: { userId, isRead: false },
    });
    res.status(200).json({ unreadCount: count });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch unread count", error });
  }
};
