// // services/activity.service.ts
// import ActivityLog from "../models/activityLog.model";

import ActivityLog from "../models/activityLog.model";

// export const logActivity = async (userId: number, action: string, details?: string) => {
//   await ActivityLog.create({ userId, action, details });
// };



export const logActivity = async (
  userId: number,
  action: string,
  description: string,
  userName?: string
) => {
  const activity = await ActivityLog.create({
    userId,
    userName: userName || null, // ✅ new column
    action,
    details: description,       // ✅ your model calls it "details"
    created_at: new Date(),     // ✅ matches model
  });

  return activity;
};
