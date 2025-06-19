// constants/emailPermissions.ts

import { PERMISSIONS } from "./permissions";

export const EMAIL_PERMISSIONS = [
  PERMISSIONS.USER_CREATE,              // Send welcome email
  PERMISSIONS.ORDER_CREATE,             // Notify on new order
  PERMISSIONS.LEAD_CREATE,              // New lead email
  PERMISSIONS.CLIENT_LEAD_CREATE,       // Client lead notification
  PERMISSIONS.CAMPAIGN_CREATE,          // Campaign notification
  PERMISSIONS.USER_UPDATESTATUS,        // Block/unblock alert
  PERMISSIONS.CLIENT_LEAD_UPDATE_STATUS,// Client lead status update
  PERMISSIONS.ORDER_UPDATESTATUS,       // Order status change
];
