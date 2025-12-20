
import { parseFileBuffer } from "../utils/fileParser";
import Lead, { LeadCreationAttributes } from "../models/lead.model";
import { sendEmail } from "../utils/email";
import { assignedBulkLeadEmailTemplate } from "../Templetes/assignedBulkLeadEmail";


const excelSerialDateToDate = (serial: number): string => {
  if (!serial || isNaN(serial)) return "";
  const excelEpoch = new Date(1899, 11, 31);
  const daysInMs = serial * 24 * 60 * 60 * 1000;
  const date = new Date(excelEpoch.getTime() + daysInMs);
  return date.toISOString().split("T")[0];
};


export const importLeadsFromFile = async (
  fileBuffer: Buffer,
  mappedData?: any[],
  userId?: number // Add userId to track who imported the leads
) => {


  const rows = mappedData || parseFileBuffer(fileBuffer);

  const validLeads: LeadCreationAttributes[] = [];
  const skippedRows: { row: number; reason: string }[] = [];

  for (let [index, row] of rows.entries()) {
    try {

      if (!row.leadData || typeof row.leadData !== "object") {
        throw new Error("Missing or invalid 'leadData'");
      }

      if (row.leadData.date && typeof row.leadData.date === "number") {
        row.leadData.date = excelSerialDateToDate(row.leadData.date);
      }

      if (!row.campaignName) {
        throw new Error("Missing required field: campaignName");
      }

      if (row.assignees && !Array.isArray(row.assignees)) {
        throw new Error("Invalid assignees format (must be an array)");
      }

      const preparedLead: LeadCreationAttributes = {
        campaignName: row.campaignName,
        leadData: row.leadData,
        assignees: Array.isArray(row.assignees) ? row.assignees : [],
        createdBy: userId, // Set createdBy to track who imported the lead
      };


      validLeads.push(preparedLead);
    } catch (err: any) {
      skippedRows.push({ row: index + 2, reason: err.message });
    }
  }



  let insertedCount = 0;

  if (validLeads.length > 0) {
    try {
      const chunkSize = 200;

      for (let i = 0; i < validLeads.length; i += chunkSize) {
        const chunk = validLeads.slice(i, i + chunkSize);


        await Lead.bulkCreate(chunk, { validate: true });

        insertedCount += chunk.length;
      }

    } catch (dbError: any) {
      skippedRows.push({
        row: 0,
        reason: `Database error: ${dbError.message}`,
      });
    }
  } else {
  }



  return {
    imported: insertedCount,
    skipped: skippedRows,
  };
};
