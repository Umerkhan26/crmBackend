// controllers/notification.controller.ts
import { Request, Response } from "express";
import Notification from "../models/notification.model";
import { sendNotification } from "../services/notification.service";

export const sendNotificationController = async (req: Request, res: Response) => {
  const { userId, message } = req.body;
  try {
    const notification = await sendNotification(userId, message);
    res.status(201).json(notification);
  } catch (error) {
    res.status(500).json({ message: "Failed to send notification", error });
  }
};

export const getUserNotificationsController = async (req: Request, res: Response) => {
  const { userId } = req.params;
  try {
    const notifications = await Notification.findAll({
      where: { userId },
      order: [["created_at", "DESC"]],
    });
    res.status(200).json(notifications);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch notifications", error });
  }
};

export const markNotificationsAsReadController = async (req: Request, res: Response) => {
  const { userId } = req.params;
  try {
    await Notification.update({ isRead: true }, { where: { userId } });
    res.status(200).json({ message: "Notifications marked as read" });
  } catch (error) {
    res.status(500).json({ message: "Failed to mark notifications as read", error });
  }
};

export const getUnreadCountController = async (req: Request, res: Response) => {
    const { userId } = req.params;
    try {
      const count = await Notification.count({
        where: { userId, isRead: false }
      });
      res.status(200).json({ unreadCount: count });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch unread count", error });
    }
  };
  