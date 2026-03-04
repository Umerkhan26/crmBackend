import "../../db";
import { associateModels } from "./relations";

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
import "./call.model";
import "./brand.model";
import "./brandUser.model";
import "./brandManager.model";
associateModels();
