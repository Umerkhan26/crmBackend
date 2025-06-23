import express from "express";
import {
  getEmailPermissions,
  updateEmailPermission,
} from "../controllers/emailPermission.controller";

const router = express.Router();

router.get("/email-permissions", getEmailPermissions);
router.patch("/email-permissions/:serviceName", updateEmailPermission);

export default router;
