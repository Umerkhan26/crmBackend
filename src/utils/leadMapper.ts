// utils/leadMapper.ts
import { LeadCreationAttributes } from "../models/lead.model";

export const mapLeadRow = (row: any): Partial<LeadCreationAttributes> => ({
  campaignName: row.campaignName,
  leadData: row.leadData || {},
  assignees: Array.isArray(row.assignees) ? row.assignees : [],
});
