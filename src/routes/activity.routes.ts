import { Router } from "express";
import { verifyToken } from "../middleware/verifyToken.middleware";
import { getAllActivities, getActivitiesByUserId, deleteActivityById } from "../controllers/activity.controller";

const router = Router();

router.get("/getAllActivities", verifyToken, getAllActivities);
router.get("/getActivitybyId/:userId", getActivitiesByUserId);
router.delete("/activity/:id", deleteActivityById);

export default router;
