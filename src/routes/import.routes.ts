import express from "express";
import multer from "multer";
import { importOrdersController } from "../controllers/import.controller";
import { verifyToken } from "../middleware/verifyToken.middleware";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post("/orders/import", verifyToken, upload.single("file"), importOrdersController);

export default router;
