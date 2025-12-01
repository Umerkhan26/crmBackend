import { ClientLeadCreationAttributes } from "../models/clientLead.model";

export const mapClientLeadRow = (
  row: any
): Partial<ClientLeadCreationAttributes> => {
  return {
    leadData: row.leadData || {},
    status: (row.status || "pending") as ClientLeadCreationAttributes["status"],
  };
};
