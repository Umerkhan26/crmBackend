import LeadActivity from "../models/leadActivity.model";

export const logLeadActivity = async ({
  entityId,
  entityType,
  action,
  performedBy,
  details,
}: {
  entityId: number;
  entityType: "lead" | "clientLead";
  action: string;
  performedBy: number;
  details?: string;
}) => {
  try {
    await LeadActivity.create({
      entityId,
      entityType,
      action,
      performedBy,
      details,
    });
  } catch (error: any) {
  }
};
