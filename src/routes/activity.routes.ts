import { Router } from "express";
import { getAllActivities, getActivitiesByUserId } from "../controllers/activity.controller";

const router = Router();

router.get("/getAllActivities", getAllActivities);
router.get("/getActivitybyId/:id", getActivitiesByUserId);

export default router;
