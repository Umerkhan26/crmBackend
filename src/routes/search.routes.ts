import { Router } from "express";
import * as MasterSearchController from "../controllers/masterSearch.controller";
import { verifyToken } from "../middleware/verifyToken.middleware";

const router = Router();

router.get(
  "/search/master",
  verifyToken,
  MasterSearchController.masterSearch
);

export default router;


