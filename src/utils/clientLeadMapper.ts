import { ClientLeadCreationAttributes } from "../models/clientLead.model";

export const mapClientLeadRow = (
  row: any
): Partial<ClientLeadCreationAttributes> => {
  return {
    leadData: row.leadData || {}, // Use row.leadData directly
    status: (row.status || "pending") as ClientLeadCreationAttributes["status"],
  };
};
