import express from "express";
import multer from "multer";
import { importClientLeadsController } from "../controllers/importClientLead.controller";
import { verifyToken } from "../middleware/verifyToken.middleware";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });
router.post("/client-leads/import", verifyToken, upload.single("file"), importClientLeadsController);


export default router;
