// import Lead from "./lead.model";
// import { User } from "./user.model";
// import { Message } from "./chatmodels/message.model";
// import { Conversation } from "./chatmodels/conversation.model";
// import { ConversationParticipant } from "./chatmodels/conversationParticipant.model";
// import Note from "./note.model";
// import ClientLead from "./clientLead.model"; // 👈 Ensure this import is correct
// import LeadActivity from "./leadActivity.model";

// export const associateModels = () => {
//   // 📌 Chat-related associations
//   Conversation.hasMany(Message, { foreignKey: "conversationId" });
//   Message.belongsTo(Conversation, { foreignKey: "conversationId" });

//   User.hasMany(Message, { foreignKey: "senderId" });
//   Message.belongsTo(User, { foreignKey: "senderId" });

//   Conversation.belongsToMany(User, {
//     through: ConversationParticipant,
//     foreignKey: "conversationId",
//     otherKey: "userId",
//   });

//   User.belongsToMany(Conversation, {
//     through: ConversationParticipant,
//     foreignKey: "userId",
//     otherKey: "conversationId",
//   });

//   // 📌 Lead ↔ User (assignee)
//   Lead.belongsTo(User, {
//     foreignKey: "assigneeId",
//     as: "assignee",
//   });

//   User.hasMany(Lead, {
//     foreignKey: "assigneeId",
//     as: "assignedLeads",
//   });

//   // 📌 Note ↔ User (creator)
//   Note.belongsTo(User, {
//     foreignKey: "createdBy",
//     as: "creator",
//   });

//   User.hasMany(Note, {
//     foreignKey: "createdBy",
//     as: "notes",
//   });

//   // 📌 Polymorphic associations: Note ↔ Lead
//   Lead.hasMany(Note, {
//     foreignKey: "notebleId",
//     constraints: false,
//     scope: {
//       notebleType: "lead",
//     },
//     as: "notes",
//   });

//   Note.belongsTo(Lead, {
//     foreignKey: "notebleId",
//     constraints: false,
//     as: "lead",
//   });

//   // 📌 Polymorphic associations: Note ↔ ClientLead
//   ClientLead.hasMany(Note, {
//     foreignKey: "notebleId",
//     constraints: false,
//     scope: {
//       notebleType: "client_lead",
//     },
//     as: "notes",
//   });

//   Note.belongsTo(ClientLead, {
//     foreignKey: "notebleId",
//     constraints: false,
//     as: "clientLead", 
//   });
// };

// Lead.hasMany(LeadActivity, { foreignKey: "leadId", as: "activities" });
// LeadActivity.belongsTo(Lead, { foreignKey: "leadId" });
// Lead.hasMany(Note, { foreignKey: "leadId", as: "notess",onDelete: "CASCADE" }); 
// Note.belongsTo(Lead, { foreignKey: "leadId",onDelete: "CASCADE" });


// LeadActivity.belongsTo(User, { foreignKey: "performedBy", as: "performedByUser",onDelete: "CASCADE" });
// User.hasMany(LeadActivity, { foreignKey: "performedBy", as: "activitiesPerformed",onDelete: "CASCADE" });


import Lead from "./lead.model";
import { User } from "./user.model";
import { Message } from "./chatmodels/message.model";
import { Conversation } from "./chatmodels/conversation.model";
import { ConversationParticipant } from "./chatmodels/conversationParticipant.model";
import Note from "./note.model";
import ClientLead from "./clientLead.model"; // 👈 Ensure this import is correct
import LeadActivity from "./leadActivity.model";

export const associateModels = () => {
  // 📌 Chat-related associations
  Conversation.hasMany(Message, { foreignKey: "conversationId", onDelete: "CASCADE" });
  Message.belongsTo(Conversation, { foreignKey: "conversationId", onDelete: "CASCADE" });

  User.hasMany(Message, { foreignKey: "senderId", onDelete: "CASCADE" });
  Message.belongsTo(User, { foreignKey: "senderId", onDelete: "CASCADE" });

  Conversation.belongsToMany(User, {
    through: ConversationParticipant,
    foreignKey: "conversationId",
    otherKey: "userId",
    onDelete: "CASCADE",
  });

  User.belongsToMany(Conversation, {
    through: ConversationParticipant,
    foreignKey: "userId",
    otherKey: "conversationId",
    onDelete: "CASCADE",
  });

  // 📌 Lead ↔ User (assignee)
  Lead.belongsTo(User, {
    foreignKey: "assigneeId",
    as: "assignee",
    onDelete: "CASCADE",
  });

  User.hasMany(Lead, {
    foreignKey: "assigneeId",
    as: "assignedLeads",
    onDelete: "CASCADE",
  });

  // 📌 Note ↔ User (creator)
  Note.belongsTo(User, {
    foreignKey: "createdBy",
    as: "creator",
    onDelete: "CASCADE",
  });

  User.hasMany(Note, {
    foreignKey: "createdBy",
    as: "notes",
    onDelete: "CASCADE",
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

  // Note.belongsTo(Lead, {
  //   foreignKey: "notebleId",
  //   constraints: false,
  //   as: "lead",
  // });

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

// 📌 Lead ↔ LeadActivity + Notes
Lead.hasMany(LeadActivity, { foreignKey: "leadId", as: "activities", onDelete: "CASCADE" });
// LeadActivity.belongsTo(Lead, { foreignKey: "leadId", onDelete: "CASCADE" });

LeadActivity.belongsTo(Lead, { foreignKey: "leadId", as: "LeadById", onDelete: "CASCADE" });

Lead.hasMany(Note, { foreignKey: "leadId", as: "notess", onDelete: "CASCADE" });
Note.belongsTo(Lead, { foreignKey: "leadId", onDelete: "CASCADE" });

// 📌 LeadActivity ↔ User
LeadActivity.belongsTo(User, { foreignKey: "performedBy", as: "performedByUser", onDelete: "CASCADE" });
User.hasMany(LeadActivity, { foreignKey: "performedBy", as: "activitiesPerformed", onDelete: "CASCADE" });


// 📌 ClientLead ↔ LeadActivity + Notes
ClientLead.hasMany(LeadActivity, { foreignKey: "clientLeadId", as: "activities", onDelete: "CASCADE" });
LeadActivity.belongsTo(ClientLead, { foreignKey: "clientLeadId", onDelete: "CASCADE" });

// LeadActivity ↔ Lead
LeadActivity.belongsTo(Lead, {
  foreignKey: "entityId", // adjust if your column name is different
  as: "LeadEntity", // ✅ alias must match your include
  onDelete: "CASCADE",
});
Lead.hasMany(LeadActivity, {
  foreignKey: "entityId", // same name
  as: "activitiesByEntity",
  onDelete: "CASCADE",
});
