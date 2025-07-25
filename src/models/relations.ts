import  Lead  from "./lead.model"; // 👈 make sure this path is correct
import { User } from "./user.model";
import { Message } from "./chatmodels/message.model";
import { Conversation } from "./chatmodels/conversation.model";
import { ConversationParticipant } from "./chatmodels/conversationParticipant.model";
import Note from "./note.model";

export const associateModels = () => {
  // Existing chat-related associations
  Conversation.hasMany(Message, { foreignKey: "conversationId" });
  Message.belongsTo(Conversation, { foreignKey: "conversationId" });

  User.hasMany(Message, { foreignKey: "senderId" });
  Message.belongsTo(User, { foreignKey: "senderId" });

  Conversation.belongsToMany(User, {
    through: ConversationParticipant,
    foreignKey: "conversationId",
    otherKey: "userId",
  });

  User.belongsToMany(Conversation, {
    through: ConversationParticipant,
    foreignKey: "userId",
    otherKey: "conversationId",
  });

  // ✅ New: Lead ↔ User (assignee)
  Lead.belongsTo(User, {
    foreignKey: "assigneeId",
    as: "assignee",
  });

  User.hasMany(Lead, {
    foreignKey: "assigneeId",
    as: "assignedLeads",
  });
};

Note.belongsTo(User, {
  foreignKey: "createdBy",
  as: "creator",
});

User.hasMany(Note, {
  foreignKey: "createdBy",
  as: "notes",
});