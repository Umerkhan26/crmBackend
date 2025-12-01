import { Router } from "express";
import * as ChatController from "../controllers/chat.controller";

const router = Router();

router.post("/conversation", ChatController.createConversation);
router.post("/message", ChatController.sendMessage);
router.get("/messages/:conversationId", ChatController.getMessages);

export default router;
