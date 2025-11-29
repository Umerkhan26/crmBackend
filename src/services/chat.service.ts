import { Conversation } from "../models/chatmodels/conversation.model";
import { Message } from "../models/chatmodels/message.model";
import { ConversationParticipant } from "../models/chatmodels/conversationParticipant.model";
import { User } from "../models/user.model";

export const createConversation = async (participantIds: number[]) => {
  const conversation = await Conversation.create();
  await ConversationParticipant.bulkCreate(
    participantIds.map(userId => ({
      userId,
      conversationId: conversation.id,
    }))
  );
  return conversation;
};


export const sendMessage = async (
  conversationId: number,
  senderId: number,
  content: string
) => {
  const message = await Message.create({
    conversationId,
    senderId,
    content,
  });
  return message;
};

export const getMessages = async (conversationId: number) => {
  return await Message.findAll({
    where: { conversationId },
    include: [{ model: User, attributes: ["id", "firstname", "lastname", "useruimage"] }],
    order: [["createdAt", "ASC"]],
  });
};
