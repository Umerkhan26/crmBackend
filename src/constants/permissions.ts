export const PERMISSIONS = {
  // User permissions
  USER_CREATE: "user:create",
  USER_GET: "user:get",
  USER_UPDATE: "user:update",
  USER_DELETE: "user:delete",
  USER_UPDATESTATUS: "user:updateStatus",
  USER_GET_by_Id: "user:getById",
  // Campaign permissions
  CAMPAIGN_CREATE: "campaign:create",
  CAMPAIGN_GET: "campaign:get",
  CAMPAIGN_UPDATE: "campaign:update",
  CAMPAIGN_DELETE: "campaign:delete",

  // Order permissions
  ORDER_CREATE: "order:create",
  ORDER_GET: "order:get",
  ORDER_UPDATE: "order:update",
  ORDER_DELETE: "order:delete",
  ORDER_UPDATESTATUS: "order:updateStatus",
  // ORDER_BY_VENDOR_ID: "order.getOrderByVendorId",
  // Lead permissions
  LEAD_CREATE: "lead:create",
  LEAD_GET_ALL: "lead:getAll",
  LEAD_GET_BY_CAMPAIGN: "lead:getByCampaign",
  LEAD_UPDATE: "lead:update",
  LEAD_DELETE: "lead:delete",
  // LEAD_GET_BY_ASSIGNEE: "lead:getByAssignee",
  // LEAD_ASSIGN_USER: "lead:assign",
  // LEAD_VIEW_ASSIGNED_USERS: "lead:view_assigned_users",
  // LEAD_VIEW_ASSIGNMENT_STATS: "lead:view_assignment_stats",
  // LEAD_VIEW_UNASSIGNED_USERS: "lead:view_unassigned_users",
  // LEAD_GET_STATUS_SUMMARY: "lead:get_status_summary", // View leads grouped by status with counts
  // LEAD_UPDATE_STATUS: "lead:update_status", // Update status for a specific assigned lead
  // LEAD_GET_BY_CAMPAIGN_AND_ASSIGNEE: "lead:get_by_campaign_and_assignee",

  // Assigned Leads
  ASSIGNED_LEAD_GET_BY_ASSIGNEE: "assignedLead:getByAssignee",
  ASSIGNED_LEAD_GET_BY_CAMPAIGN_AND_ASSIGNEE:
    "assignedLead:getByCampaignAndAssignee",
  ASSIGNED_LEAD_GET_STATUS_SUMMARY: "assignedLead:get_status_summary",
  ASSIGNED_LEAD_UPDATE_STATUS: "assignedLead:update_status",

  // ✅ Client Lead permissions
  CLIENT_LEAD_CREATE: "clientLead:create",
  CLIENT_LEAD_GET_ALL: "clientLead:getAll",
  CLIENT_LEAD_GET_BY_ORDER: "clientLead:getByOrder",
  CLIENT_LEAD_GET_BY_ID: "clientLead:getById",
  CLIENT_LEAD_UPDATE: "clientLead:update",
  CLIENT_LEAD_DELETE: "clientLead:delete",
  CLIENT_LEAD_UPDATE_STATUS: "clientLead:updateStatus",

  NOTE_CREATE: "note:create",
  NOTE_VIEW: "note:view",

  REMINDER_CREATE: "reminder:create",
  REMINDER_VIEW: "reminder:view",
  NOTE_UPDATE: "note:update",
  NOTE_DELETE: "note:delete",
  REMINDER_UPDATE: "reminder:update",
  REMINDER_DELETE: "reminder:delete",

  // PRODUCT_CONVERT_LEAD: "PRODUCT_CONVERT_LEAD",
  // PRODUCT_SALE_GET_ALL: "PRODUCT_SALE_GET_ALL",
  // PRODUCT_SALE_GET_BY_ID: "PRODUCT_SALE_GET_BY_ID",
  // PRODUCT_SALE_UPDATE: "PRODUCT_SALE_UPDATE",
  // PRODUCT_SALE_DELETE: "PRODUCT_SALE_DELETE",
  // PRODUCT_CREATE: "PRODUCT_CREATE",
  // PRODUCT_GET_ALL: "PRODUCT_GET_ALL",
  // PRODUCT_GET_BY_ID: "PRODUCT_GET_BY_ID",
  // PRODUCT_UPDATE: "PRODUCT_UPDATE",
  // PRODUCT_DELETE: "PRODUCT_DELETE",

  PRODUCT_CREATE: "PRODUCT_CREATE",
  PRODUCT_GET_ALL: "PRODUCT_GET_ALL",
  PRODUCT_GET_BY_ID: "PRODUCT_GET_BY_ID",
  PRODUCT_UPDATE: "PRODUCT_UPDATE",
  PRODUCT_DELETE: "PRODUCT_DELETE",

  SALE_CONVERT_LEAD: "SALE_CONVERT_LEAD",
  SALE_GET_ALL: "SALE_GET_ALL",
  SALE_GET_BY_ID: "SALE_GET_BY_ID",
  SALE_GET_BY_ASSIGNEE: "SALE_GET_BY_ASSIGNEE",
  SALE_UPDATE: "SALE_UPDATE",
  SALE_DELETE: "SALE_DELETE",
  SALE_CREATE: "SALE_CREATE",

  GET_INVOICE: "PRODUCT_INVOICE",
};
