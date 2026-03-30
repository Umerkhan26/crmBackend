import express from "express";
import { verifyToken } from "../middleware/verifyToken.middleware";
import { checkPermission } from "../middleware/checkPermission";
import { PERMISSIONS } from "../constants/permissions";
import * as TeamMemberController from "../controllers/teamMember.controller";

const router = express.Router();

router.use(verifyToken);

// Team member routes (following existing naming trend)
router.get(
  "/getTeamMembers/:id",
  checkPermission([PERMISSIONS.TEAM_GET, PERMISSIONS.TEAM_MANAGE_MEMBERS]),
  TeamMemberController.getTeamMembersController,
);
router.post(
  "/CreateTeamMembers/:id",
  checkPermission(PERMISSIONS.TEAM_MANAGE_MEMBERS),
  TeamMemberController.addTeamMembersController,
);
router.patch(
  "/updateTeamMemberStatus/:id/:userId",
  checkPermission(PERMISSIONS.TEAM_MANAGE_MEMBERS),
  TeamMemberController.setTeamMemberStatusController,
);
router.delete(
  "/deleteTeamMember/:id/:userId",
  checkPermission(PERMISSIONS.TEAM_MANAGE_MEMBERS),
  TeamMemberController.deleteTeamMemberController,
);


export default router;

