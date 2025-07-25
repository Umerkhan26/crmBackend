import Lead from "./lead.model";
import { User } from "./user.model";
import { Message } from "./chatmodels/message.model";
import { Conversation } from "./chatmodels/conversation.model";
import { ConversationParticipant } from "./chatmodels/conversationParticipant.model";
import Note from "./note.model";
import ClientLead from "./clientLead.model"; // 👈 Ensure this import is correct

export const associateModels = () => {
  // 📌 Chat-related associations
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

  // 📌 Lead ↔ User (assignee)
  Lead.belongsTo(User, {
    foreignKey: "assigneeId",
    as: "assignee",
  });

  User.hasMany(Lead, {
    foreignKey: "assigneeId",
    as: "assignedLeads",
  });

  // 📌 Note ↔ User (creator)
  Note.belongsTo(User, {
    foreignKey: "createdBy",
    as: "creator",
  });

  User.hasMany(Note, {
    foreignKey: "createdBy",
    as: "notes",
  });

  // 📌 Polymorphic associations: Note ↔ Lead
  Lead.hasMany(Note, {
    foreignKey: "notebleId",
    constraints: false,
    scope: {
      notebleType: "lead",
    },
    as: "notes",
  });

  Note.belongsTo(Lead, {
    foreignKey: "notebleId",
    constraints: false,
    as: "lead",
  });

  // 📌 Polymorphic associations: Note ↔ ClientLead
  ClientLead.hasMany(Note, {
    foreignKey: "notebleId",
    constraints: false,
    scope: {
      notebleType: "client_lead",
    },
    as: "notes",
  });

  Note.belongsTo(ClientLead, {
    foreignKey: "notebleId",
    constraints: false,
    as: "clientLead",
  });
};
