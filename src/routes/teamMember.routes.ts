import express from "express";
import { verifyToken } from "../middleware/verifyToken.middleware";
import { checkPermission } from "../middleware/checkPermission";
import { PERMISSIONS } from "../constants/permissions";
import * as TeamMemberController from "../controllers/teamMember.controller";

const router = express.Router();

router.use(verifyToken);

router.get(
  "/teams/:id/members",
  checkPermission([PERMISSIONS.TEAM_GET, PERMISSIONS.TEAM_MANAGE_MEMBERS]),
  TeamMemberController.getTeamMembersController,
);
router.get(
  "/getteams/:id/members",
  checkPermission([PERMISSIONS.TEAM_GET, PERMISSIONS.TEAM_MANAGE_MEMBERS]),
  TeamMemberController.getTeamMembersController,
);

router.post(
  "/teams/:id/members",
  checkPermission(PERMISSIONS.TEAM_MANAGE_MEMBERS),
  TeamMemberController.addTeamMembersController,
);

router.patch(
  "/teams/:id/members/:userId",
  checkPermission(PERMISSIONS.TEAM_MANAGE_MEMBERS),
  TeamMemberController.setTeamMemberStatusController,
);

export default router;

