

import User from "./user.model";
import Role from "./role.model";
import Permission from "./permission.model";
import RolePermission from "./rolePermission.model";
import Order from "./order.model";
import Campaign from "./campaign.model";
import ClientLead from "./clientLead.model";
import Lead from "./lead.model";
import ProductSale from "./product.model";
import Call from "./call.model";
import Brand from "./brand.model";
import BrandUser from "./brandUser.model";
import BrandManager from "./brandManager.model";
import Team from "./team.model";
import TeamMember from "./teamMember.model";
import LeadLock from "./leadLock.model";
import LeadAssignmentBatch from "./leadAssignmentBatch.model";
import TeamRotationConfig from "./teamRotationConfig.model";
import LeadRotationState from "./leadRotationState.model";
import LeadAssignmentState from "./leadAssignmentState.model";
import CustomerAccount from "./customerAccount.model";
import CustomerEngagement from "./customerEngagement.model";
import PortalAnnouncement from "./portalAnnouncement.model";
import PortalPopup from "./portalPopup.model";
import PortalActivityEvent from "./portalActivityEvent.model";
import BulkEmailCampaign from "./bulkEmailCampaign.model";
import BulkEmailJob from "./bulkEmailJob.model";

Role.belongsToMany(Permission, {
  through: RolePermission,
  foreignKey: "roleId",
  onDelete: "CASCADE",
});
Permission.belongsToMany(Role, {
  through: RolePermission,
  foreignKey: "permissionId",
  onDelete: "CASCADE",
});

Role.hasMany(User, { foreignKey: "roleId", onDelete: "CASCADE" });
User.belongsTo(Role, { foreignKey: "roleId", onDelete: "CASCADE" });

// User optional default brand (brandId nullable for old data)
User.belongsTo(Brand, { foreignKey: "brandId", as: "defaultBrand", onDelete: "SET NULL" });
Brand.hasMany(User, { foreignKey: "brandId", as: "usersByDefaultBrand" });

Order.belongsTo(Campaign, {
  foreignKey: "campaign_id",
  as: "campaign",
  onDelete: "CASCADE",
});
Campaign.hasMany(Order, {
  foreignKey: "campaign_id",
  as: "orders",
  onDelete: "CASCADE",
});

ClientLead.belongsTo(Order, { foreignKey: "order_id", as: "order", onDelete: "CASCADE" });
ClientLead.belongsTo(Campaign, { foreignKey: "campaign_id", as: "campaign", onDelete: "CASCADE" });

Order.hasMany(ClientLead, { foreignKey: "order_id", as: "clientLeads", onDelete: "CASCADE" });
Campaign.hasMany(ClientLead, { foreignKey: "campaign_id", as: "clientLeads", onDelete: "CASCADE" });

Lead.hasOne(ProductSale, { foreignKey: "leadId", onDelete: "CASCADE" });
ProductSale.belongsTo(Lead, { foreignKey: "leadId", onDelete: "CASCADE" });

Lead.belongsTo(Brand, { foreignKey: "brandId", as: "brand", onDelete: "SET NULL" });
Brand.hasMany(Lead, { foreignKey: "brandId", as: "leads", onDelete: "SET NULL" });

ProductSale.belongsTo(Brand, { foreignKey: "brandId", as: "brand", onDelete: "SET NULL" });
Brand.hasMany(ProductSale, { foreignKey: "brandId", as: "sales", onDelete: "SET NULL" });

User.hasMany(CustomerAccount, { foreignKey: "userId", as: "customerAccounts", onDelete: "CASCADE" });
CustomerAccount.belongsTo(User, { foreignKey: "userId", as: "user", onDelete: "CASCADE" });

Brand.hasMany(CustomerAccount, { foreignKey: "brandId", as: "customerAccounts", onDelete: "CASCADE" });
CustomerAccount.belongsTo(Brand, { foreignKey: "brandId", as: "brand", onDelete: "CASCADE" });

CustomerAccount.belongsTo(Lead, { foreignKey: "leadId", as: "lead", onDelete: "SET NULL" });
CustomerAccount.belongsTo(ProductSale, { foreignKey: "saleId", as: "sale", onDelete: "SET NULL" });

CustomerAccount.hasMany(CustomerEngagement, {
  foreignKey: "customerAccountId",
  as: "engagements",
  onDelete: "CASCADE",
});
CustomerEngagement.belongsTo(CustomerAccount, {
  foreignKey: "customerAccountId",
  as: "customerAccount",
  onDelete: "CASCADE",
});
CustomerEngagement.belongsTo(User, {
  foreignKey: "createdBy",
  as: "createdByUser",
  onDelete: "CASCADE",
});

CustomerAccount.hasMany(PortalActivityEvent, {
  foreignKey: "customerAccountId",
  as: "portalActivityEvents",
  onDelete: "CASCADE",
});
PortalActivityEvent.belongsTo(CustomerAccount, {
  foreignKey: "customerAccountId",
  as: "customerAccount",
  onDelete: "CASCADE",
});
PortalActivityEvent.belongsTo(User, {
  foreignKey: "userId",
  as: "user",
  onDelete: "CASCADE",
});

BulkEmailCampaign.hasMany(BulkEmailJob, {
  foreignKey: "campaignId",
  as: "jobs",
  onDelete: "CASCADE",
});
BulkEmailJob.belongsTo(BulkEmailCampaign, {
  foreignKey: "campaignId",
  as: "campaign",
  onDelete: "CASCADE",
});
BulkEmailJob.belongsTo(CustomerAccount, {
  foreignKey: "customerAccountId",
  as: "customerAccount",
  onDelete: "CASCADE",
});
BulkEmailCampaign.belongsTo(User, {
  foreignKey: "createdBy",
  as: "createdByUser",
  onDelete: "CASCADE",
});

Brand.hasMany(PortalAnnouncement, {
  foreignKey: "brandId",
  as: "portalAnnouncements",
  onDelete: "CASCADE",
});
PortalAnnouncement.belongsTo(Brand, {
  foreignKey: "brandId",
  as: "brand",
  onDelete: "CASCADE",
});

Brand.hasMany(PortalPopup, {
  foreignKey: "brandId",
  as: "portalPopups",
  onDelete: "CASCADE",
});
PortalPopup.belongsTo(Brand, {
  foreignKey: "brandId",
  as: "brand",
  onDelete: "CASCADE",
});

User.hasMany(ProductSale, { foreignKey: "createdBy", onDelete: "CASCADE" });
ProductSale.belongsTo(User, { foreignKey: "createdBy", onDelete: "CASCADE" });

User.hasMany(Lead, { foreignKey: "assigneeId", onDelete: "CASCADE" });
Lead.belongsTo(User, { foreignKey: "assigneeId", onDelete: "CASCADE" });

Campaign.hasMany(ProductSale, {
  foreignKey: "campaignId",
  sourceKey: "id",
  as: "productSales",
  onDelete: "SET NULL",
});
ProductSale.belongsTo(Campaign, {
  foreignKey: "campaignId",
  targetKey: "id",
  as: "campaign",
  onDelete: "SET NULL",
});

User.hasMany(ProductSale, {
  foreignKey: "assigneeId",
  as: "assignedProducts",
  onDelete: "CASCADE",
});
ProductSale.belongsTo(User, {
  foreignKey: "assigneeId",
  as: "assignee",
  onDelete: "CASCADE",
});

// Call associations
User.hasMany(Call, { foreignKey: "userId", onDelete: "CASCADE" });
Call.belongsTo(User, { foreignKey: "userId", onDelete: "CASCADE" });

Lead.hasMany(Call, { foreignKey: "leadId", onDelete: "SET NULL" });
Call.belongsTo(Lead, { foreignKey: "leadId", onDelete: "SET NULL" });

ClientLead.hasMany(Call, { foreignKey: "clientLeadId", onDelete: "SET NULL" });
Call.belongsTo(ClientLead, { foreignKey: "clientLeadId", onDelete: "SET NULL" });

// Brand associations
// Brand ↔ User (Many-to-Many through BrandUser)
Brand.belongsToMany(User, {
  through: BrandUser,
  foreignKey: "brandId",
  otherKey: "userId",
  as: "users",
  onDelete: "CASCADE",
});

User.belongsToMany(Brand, {
  through: BrandUser,
  foreignKey: "userId",
  otherKey: "brandId",
  as: "brands",
  onDelete: "CASCADE",
});

Brand.hasMany(BrandUser, {
  foreignKey: "brandId",
  as: "brandUserRelations",
  onDelete: "CASCADE",
});

BrandUser.belongsTo(Brand, {
  foreignKey: "brandId",
  as: "brand",
  onDelete: "CASCADE",
});

BrandUser.belongsTo(User, {
  foreignKey: "userId",
  as: "user",
  onDelete: "CASCADE",
});

User.hasMany(BrandUser, {
  foreignKey: "userId",
  as: "brandUserRelations",
  onDelete: "CASCADE",
});

// Brand ↔ User (as Manager) (Many-to-Many through BrandManager)
Brand.belongsToMany(User, {
  through: BrandManager,
  foreignKey: "brandId",
  otherKey: "managerId",
  as: "managers",
  onDelete: "CASCADE",
});

User.belongsToMany(Brand, {
  through: BrandManager,
  foreignKey: "managerId",
  otherKey: "brandId",
  as: "managedBrands",
  onDelete: "CASCADE",
});

Brand.hasMany(BrandManager, {
  foreignKey: "brandId",
  as: "brandManagerRelations",
  onDelete: "CASCADE",
});

BrandManager.belongsTo(Brand, {
  foreignKey: "brandId",
  as: "brand",
  onDelete: "CASCADE",
});

BrandManager.belongsTo(User, {
  foreignKey: "managerId",
  as: "manager",
  onDelete: "CASCADE",
});

User.hasMany(BrandManager, {
  foreignKey: "managerId",
  as: "brandManagerRelations",
  onDelete: "CASCADE",
});

// Team associations
Team.hasMany(TeamMember, { foreignKey: "teamId", as: "teamMembers", onDelete: "CASCADE" });
TeamMember.belongsTo(Team, { foreignKey: "teamId", as: "team", onDelete: "CASCADE" });

User.hasOne(TeamMember, { foreignKey: "userId", as: "teamMembership", onDelete: "CASCADE" });
TeamMember.belongsTo(User, { foreignKey: "userId", as: "user", onDelete: "CASCADE" });

// Convenience many-to-many (Team <-> User) via TeamMember
Team.belongsToMany(User, {
  through: TeamMember,
  foreignKey: "teamId",
  otherKey: "userId",
  as: "members",
  onDelete: "CASCADE",
});
User.belongsToMany(Team, {
  through: TeamMember,
  foreignKey: "userId",
  otherKey: "teamId",
  as: "teams",
  onDelete: "CASCADE",
});

// Lead lock associations
Lead.hasMany(LeadLock, { foreignKey: "leadId", as: "leadLocks", onDelete: "CASCADE" });
LeadLock.belongsTo(Lead, { foreignKey: "leadId", as: "lead", onDelete: "CASCADE" });
User.hasMany(LeadLock, { foreignKey: "lockedByUserId", as: "lockedLeads", onDelete: "CASCADE" });
LeadLock.belongsTo(User, { foreignKey: "lockedByUserId", as: "lockedBy", onDelete: "CASCADE" });

// Lead assignment batch associations
User.hasMany(LeadAssignmentBatch, {
  foreignKey: "triggeredByUserId",
  as: "leadAssignmentBatches",
  onDelete: "SET NULL",
});
LeadAssignmentBatch.belongsTo(User, {
  foreignKey: "triggeredByUserId",
  as: "triggeredBy",
  onDelete: "SET NULL",
});

// Lead rotation/assignment state associations
Lead.hasOne(LeadRotationState, { foreignKey: "leadId", as: "rotationState", onDelete: "CASCADE" });
LeadRotationState.belongsTo(Lead, { foreignKey: "leadId", as: "lead", onDelete: "CASCADE" });
Team.hasMany(LeadRotationState, { foreignKey: "teamId", as: "rotationLeads", onDelete: "SET NULL" });
LeadRotationState.belongsTo(Team, { foreignKey: "teamId", as: "team", onDelete: "SET NULL" });

Lead.hasOne(LeadAssignmentState, { foreignKey: "leadId", as: "assignmentState", onDelete: "CASCADE" });
LeadAssignmentState.belongsTo(Lead, { foreignKey: "leadId", as: "lead", onDelete: "CASCADE" });
Team.hasMany(LeadAssignmentState, { foreignKey: "teamId", as: "assignmentLeads", onDelete: "SET NULL" });
LeadAssignmentState.belongsTo(Team, { foreignKey: "teamId", as: "team", onDelete: "SET NULL" });
User.hasMany(LeadAssignmentState, {
  foreignKey: "currentAssigneeUserId",
  as: "assignedLeadStates",
  onDelete: "SET NULL",
});
LeadAssignmentState.belongsTo(User, {
  foreignKey: "currentAssigneeUserId",
  as: "currentAssignee",
  onDelete: "SET NULL",
});
