// models/index.ts
import "../../db"; // Initialize DB
import { associateModels } from "./relations";

// Import all models (auto-registers them with Sequelize)
import "./user.model";
// import "./chatmodels/message.model";
// import "./chatmodels/conversation.model";
// import "./chatmodels/conversationParticipant.model";

import "./lead.model";

import "./campaign.model";
import "./clientLead.model";
import "./leadActivity.model";
import "./note.model";
import "./activityLog.model";
import "./notification.model"
import "./emailLog.model";
import "./order.model";
import "./product.model";
import "./role.model";
import "./rolePermission.model";
import "./permission.model";
import "./emailTemplate.model";
import "./emailPermission.model";
// Apply associations
associateModels();
