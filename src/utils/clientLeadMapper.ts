import { ClientLeadCreationAttributes } from "../models/clientLead.model";

/**
 * Maps a raw row from Excel to the ClientLead model format.
 */
export const mapClientLeadRow = (row: any): Partial<ClientLeadCreationAttributes> => {
  return {
    order_id: row["Order ID"] ? Number(row["Order ID"]) : undefined,
    campaign_id: row["Campaign ID"] ? Number(row["Campaign ID"]) : undefined,
    leadData: (() => {
      try {
        return row["Lead Data"] ? JSON.parse(row["Lead Data"]) : {};
      } catch (err) {
        throw new Error("Invalid JSON format in Lead Data");
      }
    })(),
    status: (row["Status"] || "pending") as ClientLeadCreationAttributes["status"],
  };
};
