import { Router } from "express";
import { getAllActivities, getActivitiesByUserId, deleteActivityById } from "../controllers/activity.controller";

const router = Router();

router.get("/getAllActivities", getAllActivities);
router.get("/getActivitybyId/:userId", getActivitiesByUserId);
router.delete("/activity/:id", deleteActivityById);

export default router;
