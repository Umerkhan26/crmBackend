import { Router } from "express";
import {
  getUnreadCountController,
  getUserNotificationsController,
  markNotificationsAsReadController,
  sendNotificationController,
} from "../controllers/notification.controller";
import { verifyToken } from "../middleware/verifyToken.middleware";


const router = Router();

router.post(
  "/send",
  verifyToken,
  sendNotificationController
);

router.get(
  "/getNotificationById/:userId",
  verifyToken,
  getUserNotificationsController
);

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
