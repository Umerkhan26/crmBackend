

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
