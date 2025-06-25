import { ClientLeadCreationAttributes } from "../models/clientLead.model";

/**
 * Maps a raw row from Excel to the ClientLead model format.
 */
export const mapClientLeadRow = (row: any): Partial<ClientLeadCreationAttributes> => {
  return {
    order_id: Number(row["Order ID"]),
    campaign_id: Number(row["Campaign ID"]),
    leadData: JSON.parse(row["Lead Data"] || "{}"), // Make sure "Lead Data" is a valid JSON string
    status: (row["Status"] || "pending") as ClientLeadCreationAttributes["status"],
  };
};
