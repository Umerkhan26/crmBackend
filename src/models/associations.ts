// import User from "./user.model";
// import Role from "./role.model";
// import Permission from "./permission.model";
// import RolePermission from "./rolePermission.model";

// // Role ↔ Permission (Many-to-Many)
// Role.belongsToMany(Permission, {
//   through: RolePermission,
//   foreignKey: "roleId",
//   otherKey: "permissionId",
//   as: "permissions",
// });

// Permission.belongsToMany(Role, {
//   through: RolePermission,
//   foreignKey: "permissionId",
//   otherKey: "roleId",
//   as: "roles",
// });

// // Role ↔ User (One-to-Many)
// Role.hasMany(User, { foreignKey: "roleId" }); // ✅ No alias here
// User.belongsTo(Role, { foreignKey: "roleId", as: "role" }); // ✅ Use alias only ONCE

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