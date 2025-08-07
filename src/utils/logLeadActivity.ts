import LeadActivity from "../models/leadActivity.model"; // adjust path if needed

export const logLeadActivity = async ({
  leadId,
  action,
  performedBy,
  details,
}: {
  leadId: number;
  action: string;
  performedBy: number;
  details?: string;
}) => {
  try {
    await LeadActivity.create({
      leadId,
      action,
      performedBy,
      details,
    });
  } catch (error: any) {
    console.error("❌ Error logging lead activity:", error.message);
    // Optional: don't throw, so it doesn’t block other flows
  }
};
