import { Router } from "express";
import { verifyToken } from "../middleware/verifyToken.middleware";
import { checkPermission } from "../middleware/checkPermission";
import { PERMISSIONS } from "../constants/permissions";
import {
  listFollowUpSequencesController,
  updateFollowUpSequenceController,
  listFollowUpStepsContentController,
  createFollowUpStepContentController,
  updateFollowUpStepContentController,
  deleteFollowUpStepController,
  listFollowUpStepTimingsController,
  updateFollowUpStepTimingController,
  listFollowUpEnrollmentsController,
  backfillFollowUpEnrollmentsController,
  getFollowUpStatsController,
  processFollowUpEmailsNowController,
} from "../controllers/followUpEmail.controller";

const router = Router();
const managePerm = PERMISSIONS.CUSTOMER_ACCOUNT_CREATE;

router.use(verifyToken);

router.get("/sequences", checkPermission(managePerm), listFollowUpSequencesController);
router.patch(
  "/sequences/:sequenceId",
  checkPermission(managePerm),
  updateFollowUpSequenceController
);

router.get("/content", checkPermission(managePerm), listFollowUpStepsContentController);
router.post("/content", checkPermission(managePerm), createFollowUpStepContentController);
router.patch(
  "/content/:stepId",
  checkPermission(managePerm),
  updateFollowUpStepContentController
);
router.delete(
  "/content/:stepId",
  checkPermission(managePerm),
  deleteFollowUpStepController
);

router.get("/schedule", checkPermission(managePerm), listFollowUpStepTimingsController);
router.patch(
  "/schedule/:stepId",
  checkPermission(managePerm),
  updateFollowUpStepTimingController
);

router.get("/enrollments", checkPermission(managePerm), listFollowUpEnrollmentsController);
router.post(
  "/enrollments/backfill",
  checkPermission(managePerm),
  backfillFollowUpEnrollmentsController
);
router.get("/stats", checkPermission(managePerm), getFollowUpStatsController);
router.post(
  "/process-now",
  checkPermission(managePerm),
  processFollowUpEmailsNowController
);

export default router;
