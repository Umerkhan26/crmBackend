import express from "express";
import multer from "multer";
import { importClientLeadsController } from "../controllers/importClientLead.controller";
import { verifyToken } from "../middleware/verifyToken.middleware";

const router = express.Router();
const storage = multer.memoryStorage();

export const upload = multer({
    storage,
    limits: {
        fileSize: 20 * 1024 * 1024,  // allow up to 20MB file
        fieldSize: 10 * 1024 * 1024, // allow up to 10MB text fields
    },
}); router.post("/client-leads/import", verifyToken, upload.single("file"), importClientLeadsController);


export default router;
