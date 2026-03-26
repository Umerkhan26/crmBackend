import express from "express";
import { verifyToken } from "../middleware/verifyToken.middleware";
import { checkPermission } from "../middleware/checkPermission";
import { PERMISSIONS } from "../constants/permissions";
import * as TeamController from "../controllers/team.controller";

const router = express.Router();

// All team routes require authentication
router.use(verifyToken);

// Base path will be /api (auto-mounted), so routes are /api/teams...

// Seed default teams A-E (idempotent)
router.post(
  "/teams/seed-default",
  checkPermission([PERMISSIONS.TEAM_CREATE, PERMISSIONS.TEAM_UPDATE]),
  TeamController.seedTeamsController,
);

// Teams CRUD
router.get("/teams", checkPermission(PERMISSIONS.TEAM_GET), TeamController.getAllTeamsController);
router.post("/teams", checkPermission(PERMISSIONS.TEAM_CREATE), TeamController.createTeamController);
router.get("/teams/:id", checkPermission(PERMISSIONS.TEAM_GET), TeamController.getTeamByIdController);
router.put("/teams/:id", checkPermission(PERMISSIONS.TEAM_UPDATE), TeamController.updateTeamController);
router.delete("/teams/:id", checkPermission(PERMISSIONS.TEAM_DELETE), TeamController.deleteTeamController);

// Members
router.get(
  "/teams/:id/members",
  checkPermission([PERMISSIONS.TEAM_GET, PERMISSIONS.TEAM_MANAGE_MEMBERS]),
  TeamController.getTeamMembersController,
);
router.post(
  "/teams/:id/members",
  checkPermission(PERMISSIONS.TEAM_MANAGE_MEMBERS),
  TeamController.addTeamMembersController,
);
router.patch(
  "/teams/:id/members/:userId",
  checkPermission(PERMISSIONS.TEAM_MANAGE_MEMBERS),
  TeamController.setTeamMemberStatusController,
);

export default router;

