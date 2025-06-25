import { parseFileBuffer } from "../utils/fileParser";
import { mapClientLeadRow } from "../utils/clientLeadMapper";
import ClientLead, { ClientLeadCreationAttributes } from "../models/clientLead.model";

export const importClientLeadsFromFile = async (fileBuffer: Buffer, createdBy: number) => {
  const rows = parseFileBuffer(fileBuffer);

  const validLeads: ClientLeadCreationAttributes[] = [];
  const skippedRows: { row: number; reason: string }[] = [];

  for (let [index, row] of rows.entries()) {
    try {
      const lead = mapClientLeadRow(row);

      // ✅ Only require leadData, not order_id or campaign_id
      if (!lead.leadData || typeof lead.leadData !== "object") {
        throw new Error("Missing or invalid 'Lead Data'");
      }

      validLeads.push({
        ...lead,
        created_by: createdBy,
      } as ClientLeadCreationAttributes);
    } catch (err: any) {
      skippedRows.push({ row: index + 2, reason: err.message });
    }
  }

  if (validLeads.length > 0) {
    await ClientLead.bulkCreate(validLeads);
  }

  return {
    imported: validLeads.length,
    skipped: skippedRows,
  };
};
