import express from "express";
import {
  createRoleController,
  deleteRoleController,
  getRolesController,
  updateRolePermissionsController,
} from "../controllers/role.controller";

const router = express.Router();

router.post("/create", createRoleController);
router.get("/all", getRolesController);
router.put("/updateRole/:id", updateRolePermissionsController);
router.delete("/delete/:id", deleteRoleController );              // Delete a role by ID

export default router;
 