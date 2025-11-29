import express from "express";
import {
  createRoleController,
  deleteRoleController,
  getRoleByUserIdController,
  getRolesController,
  updateRolePermissionsController,
} from "../controllers/role.controller";

const router = express.Router();

router.post("/create", createRoleController);
router.get("/all", getRolesController);
router.put("/updateRole/:id", updateRolePermissionsController);
router.delete("/deleteRole/:id", deleteRoleController);
router.get("/roles/:userId", getRoleByUserIdController);

export default router;
