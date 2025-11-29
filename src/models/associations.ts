

import User from "./user.model";
import Role from "./role.model";
import Permission from "./permission.model";
import RolePermission from "./rolePermission.model";
import Order from "./order.model";
import Campaign from "./campaign.model";
import ClientLead from "./clientLead.model";
import Lead from "./lead.model";
import ProductSale from "./product.model";

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
  onDelete: "CASCADE",
});
ProductSale.belongsTo(Campaign, {
  foreignKey: "campaignId",
  targetKey: "id",
  as: "campaign",
  onDelete: "CASCADE",
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
