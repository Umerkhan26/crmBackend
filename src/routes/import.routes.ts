import express from "express";
import multer from "multer";
import { importClientLeadsController } from "../controllers/importClientLead.controller";
import { verifyToken } from "../middleware/verifyToken.middleware";

const router = express.Router();
const storage = multer.memoryStorage();

export const upload = multer({
    storage,
    limits: {
        fileSize: 200 * 1024 * 1024,   // 200 MB file
        fieldSize: 50 * 1024 * 1024,   // 50 MB fields
        fields: 2000,                  // max number of text fields
        files: 10,                     // max number of files
        parts: 3000                    // total fields + files
    },
});

router.post("/client-leads/import", verifyToken, upload.single("file"), importClientLeadsController);


export default router;
