

import User from "./user.model";
import Role from "./role.model";
import Permission from "./permission.model";
import RolePermission from "./rolePermission.model";
import Order from "./order.model";
import Campaign from "./campaign.model";
import ClientLead from "./clientLead.model";
import Lead from "./lead.model";
import ProductSale from "./product.model";

// Relations
Role.belongsToMany(Permission, {
  through: RolePermission,
  foreignKey: "roleId",
});
Permission.belongsToMany(Role, {
  through: RolePermission,
  foreignKey: "permissionId",
});

Role.hasMany(User, { foreignKey: "roleId" });
User.belongsTo(Role, { foreignKey: "roleId" });

// Order belongs to Campaign
Order.belongsTo(Campaign, {
  foreignKey: "campaign_id",
  as: "campaign",
});

// Campaign has many Orders
Campaign.hasMany(Order, {
  foreignKey: "campaign_id",
  as: "orders",
});

ClientLead.belongsTo(Order, { foreignKey: "order_id", as: "order" });
ClientLead.belongsTo(Campaign, { foreignKey: "campaign_id", as: "campaign" });

Order.hasMany(ClientLead, { foreignKey: "order_id", as: "clientLeads" });
Campaign.hasMany(ClientLead, { foreignKey: "campaign_id", as: "clientLeads" });


Lead.hasOne(ProductSale, { foreignKey: "leadId" });
ProductSale.belongsTo(Lead, { foreignKey: "leadId" });

// User → ProductSale (creator/assignee)
User.hasMany(ProductSale, { foreignKey: "createdBy" });
ProductSale.belongsTo(User, { foreignKey: "createdBy" });

// Optional: User → Lead (if not already set)
User.hasMany(Lead, { foreignKey: "assigneeId" });
Lead.belongsTo(User, { foreignKey: "assigneeId" });
Campaign.hasMany(ProductSale, {
  foreignKey: "campaignId", // ✅ Changed
  sourceKey: "id",          // ✅ Changed
  as: "productSales",
});

ProductSale.belongsTo(Campaign, {
  foreignKey: "campaignId", // ✅ Changed
  targetKey: "id",          // ✅ Changed
  as: "campaign",
});

// User (assignee) → ProductSale
User.hasMany(ProductSale, {
  foreignKey: "assigneeId",
  as: "assignedProducts",
});

ProductSale.belongsTo(User, {
  foreignKey: "assigneeId",
  as: "assignee",
});