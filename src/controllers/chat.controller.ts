import { Request, Response } from "express";
import * as ChatService from "../services/chat.service";

export const createConversation = async (req: Request, res: Response) => {
  const { participantIds } = req.body;
  try {
    const conversation = await ChatService.createConversation(participantIds);
    res.status(201).json(conversation);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
};

export const sendMessage = async (req: Request, res: Response) => {
  const { conversationId, senderId, content } = req.body;
  try {
    const message = await ChatService.sendMessage(conversationId, senderId, content);
    global.io.to(`user_${senderId}`).emit("new_message", message);
    res.status(201).json(message);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
};

export const getMessages = async (req: Request, res: Response) => {
  const { conversationId } = req.params;
  try {
    const messages = await ChatService.getMessages(parseInt(conversationId));
    res.status(200).json(messages);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
};
