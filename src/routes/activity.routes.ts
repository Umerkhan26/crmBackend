import { Router } from "express";
import { getAllActivities, getActivityById } from "../controllers/activity.controller";

const router = Router();

router.get("/getAllActivities", getAllActivities);
router.get("/getActivitybyId/:id", getActivityById);

export default router;
