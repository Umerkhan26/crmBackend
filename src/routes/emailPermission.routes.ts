import express from "express";
import {
  getEmailPermissions,
  getEmailPermissionsWithRoles,
  updateEmailPermission,
} from "../controllers/emailPermission.controller";

const router = express.Router();

router.get("/email-permissions", getEmailPermissions);
router.patch("/email-permissions/:serviceName", updateEmailPermission);
router.get("/email-permissions-with-roles", getEmailPermissionsWithRoles);

export default router;
