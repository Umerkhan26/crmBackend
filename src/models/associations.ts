

// import User from "./user.model";
// import Role from "./role.model";
// import Permission from "./permission.model";
// import RolePermission from "./rolePermission.model";
// import Order from "./order.model";
// import Campaign from "./campaign.model";
// import ClientLead from "./clientLead.model";
// import Lead from "./lead.model";
// import ProductSale from "./product.model";

// // Relations
// Role.belongsToMany(Permission, {
//   through: RolePermission,
//   foreignKey: "roleId",
// });
// Permission.belongsToMany(Role, {
//   through: RolePermission,
//   foreignKey: "permissionId",
// });

// Role.hasMany(User, { foreignKey: "roleId" });
// User.belongsTo(Role, { foreignKey: "roleId" });

// // Order belongs to Campaign
// Order.belongsTo(Campaign, {
//   foreignKey: "campaign_id",
//   as: "campaign",
// });

// // Campaign has many Orders
// Campaign.hasMany(Order, {
//   foreignKey: "campaign_id",
//   as: "orders",
// });

// ClientLead.belongsTo(Order, { foreignKey: "order_id", as: "order" });
// ClientLead.belongsTo(Campaign, { foreignKey: "campaign_id", as: "campaign" });

// Order.hasMany(ClientLead, { foreignKey: "order_id", as: "clientLeads" });
// Campaign.hasMany(ClientLead, { foreignKey: "campaign_id", as: "clientLeads" });


// Lead.hasOne(ProductSale, { foreignKey: "leadId" });
// ProductSale.belongsTo(Lead, { foreignKey: "leadId" });

// // User → ProductSale (creator/assignee)
// User.hasMany(ProductSale, { foreignKey: "createdBy" });
// ProductSale.belongsTo(User, { foreignKey: "createdBy" });

// // Optional: User → Lead (if not already set)
// User.hasMany(Lead, { foreignKey: "assigneeId" });
// Lead.belongsTo(User, { foreignKey: "assigneeId" });
// Campaign.hasMany(ProductSale, {
//   foreignKey: "campaignId", // ✅ Changed
//   sourceKey: "id",          // ✅ Changed
//   as: "productSales",
// });

// ProductSale.belongsTo(Campaign, {
//   foreignKey: "campaignId", // ✅ Changed
//   targetKey: "id",          // ✅ Changed
//   as: "campaign",
// });

// // User (assignee) → ProductSale
// User.hasMany(ProductSale, {
//   foreignKey: "assigneeId",
//   as: "assignedProducts",
// });

// ProductSale.belongsTo(User, {
//   foreignKey: "assigneeId",
//   as: "assignee",
// });


import User from "./user.model";
import Role from "./role.model";
import Permission from "./permission.model";
import RolePermission from "./rolePermission.model";
import Order from "./order.model";
import Campaign from "./campaign.model";
import ClientLead from "./clientLead.model";
import Lead from "./lead.model";
import ProductSale from "./product.model";

// Role ↔ Permission
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

// Order ↔ Campaign
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

// ClientLead ↔ Order / Campaign
ClientLead.belongsTo(Order, { foreignKey: "order_id", as: "order", onDelete: "CASCADE" });
ClientLead.belongsTo(Campaign, { foreignKey: "campaign_id", as: "campaign", onDelete: "CASCADE" });

Order.hasMany(ClientLead, { foreignKey: "order_id", as: "clientLeads", onDelete: "CASCADE" });
Campaign.hasMany(ClientLead, { foreignKey: "campaign_id", as: "clientLeads", onDelete: "CASCADE" });

// Lead ↔ ProductSale
Lead.hasOne(ProductSale, { foreignKey: "leadId", onDelete: "CASCADE" });
ProductSale.belongsTo(Lead, { foreignKey: "leadId", onDelete: "CASCADE" });

// User ↔ ProductSale (creator)
User.hasMany(ProductSale, { foreignKey: "createdBy", onDelete: "CASCADE" });
ProductSale.belongsTo(User, { foreignKey: "createdBy", onDelete: "CASCADE" });

// User ↔ Lead (assignee)
User.hasMany(Lead, { foreignKey: "assigneeId", onDelete: "CASCADE" });
Lead.belongsTo(User, { foreignKey: "assigneeId", onDelete: "CASCADE" });

// Campaign ↔ ProductSale
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

// User (assignee) ↔ ProductSale
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
