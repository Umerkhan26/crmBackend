
import ActivityLog from "../models/activityLog.model";




export const logActivity = async (
  userId: number,
  action: string,
  description: string,
  userName?: string
) => {
  const activity = await ActivityLog.create({
    userId,
    userName: userName || null,
    action,
    details: description,
    created_at: new Date(),
  });

  return activity;
};
