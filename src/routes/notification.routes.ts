import { Router } from "express";
import {
    getUnreadCountController,
  getUserNotificationsController,
  markNotificationsAsReadController,
  sendNotificationController,
} from "../controllers/notification.controller";
import { verifyToken } from "../middleware/verifyToken.middleware";


const router = Router();

// Send notification manually (if needed, like admin broadcast)
router.post(
  "/send",
  verifyToken,
  sendNotificationController
);

// Get all notifications for a specific user
router.get(
  "/:userId",
  verifyToken,
  getUserNotificationsController
);

// Mark all notifications as read for a specific user
router.put(
  "/:userId/mark-read",
  verifyToken,
  markNotificationsAsReadController
);


router.get("/:userId/unread-count",
    verifyToken,
    getUnreadCountController
);

export default router;
