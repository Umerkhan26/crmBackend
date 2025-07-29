// models/index.ts
import "../../db"; // Initialize DB
import { associateModels } from "./relations";

// Import all models (auto-registers them with Sequelize)
import "./user.model";
import "./chatmodels/message.model";
import "./chatmodels/conversation.model";
import "./chatmodels/conversationParticipant.model";

import "./lead.model";

import "./campaign.model";

import "./activityLog.model";
import "./emailLog.model";

// Apply associations
associateModels();
