// import { parseFileBuffer } from "../utils/fileParser";
// import Lead, { LeadCreationAttributes } from "../models/lead.model";

// /**
//  * Convert Excel serial date to YYYY-MM-DD string
//  */
// const excelSerialDateToDate = (serial: number): string => {
//   if (!serial || isNaN(serial)) return "";
//   const excelEpoch = new Date(1899, 11, 31);
//   const daysInMs = serial * 24 * 60 * 60 * 1000;
//   const date = new Date(excelEpoch.getTime() + daysInMs);
//   return date.toISOString().split("T")[0];
// };

// /**
//  * Import leads from Excel/CSV file
//  */
// export const importLeadsFromFile = async (
//   fileBuffer: Buffer,
//   mappedData?: any[]
// ) => {

//   const rows = mappedData || parseFileBuffer(fileBuffer);

//   const validLeads: LeadCreationAttributes[] = [];
//   const skippedRows: { row: number; reason: string }[] = [];

//   for (let [index, row] of rows.entries()) {
//     try {

//       // ✅ Ensure leadData exists
//       if (!row.leadData || typeof row.leadData !== "object") {
//         throw new Error("Missing or invalid 'leadData'");
//       }

//       // ✅ Convert Excel serial date if needed
//       if (row.leadData.date && typeof row.leadData.date === "number") {
//         row.leadData.date = excelSerialDateToDate(row.leadData.date);
//       }

//       // ✅ Validate required fields
//       if (!row.campaignName) {
//         throw new Error("Missing required field: campaignName");
//       }

//       // ✅ Validate optional assignees (ensure it's an array)
//       if (row.assignees && !Array.isArray(row.assignees)) {
//         throw new Error("Invalid assignees format (must be an array)");
//       }

//       // ✅ Prepare Lead record
//       const preparedLead: LeadCreationAttributes = {
//         campaignName: row.campaignName,
//         leadData: row.leadData,
//         assignees: Array.isArray(row.assignees) ? row.assignees : [],
//       };


//       validLeads.push(preparedLead);
//     } catch (err: any) {
//       skippedRows.push({ row: index + 2, reason: err.message });
//     }
//   }



//   let insertedCount = 0;

//   if (validLeads.length > 0) {
//     try {
//       await Lead.bulkCreate(validLeads, { validate: true });
//       insertedCount = validLeads.length;
//     } catch (dbError: any) {
//       skippedRows.push({
//         row: 0,
//         reason: `Database error: ${dbError.message}`,
//       });
//     }
//   } else {
//   }



//   return {
//     imported: insertedCount,
//     skipped: skippedRows,
//   };
// };


import { parseFileBuffer } from "../utils/fileParser";
import Lead, { LeadCreationAttributes } from "../models/lead.model";
import { sendEmail } from "../utils/email";
import { assignedBulkLeadEmailTemplate } from "../Templetes/assignedBulkLeadEmail";

/**
 * Convert Excel serial date to YYYY-MM-DD string
 */
const excelSerialDateToDate = (serial: number): string => {
  if (!serial || isNaN(serial)) return "";
  const excelEpoch = new Date(1899, 11, 31);
  const daysInMs = serial * 24 * 60 * 60 * 1000;
  const date = new Date(excelEpoch.getTime() + daysInMs);
  return date.toISOString().split("T")[0];
};

/**
 * Import leads from Excel/CSV file
 */
export const importLeadsFromFile = async (
  fileBuffer: Buffer,
  mappedData?: any[]
) => {


  const rows = mappedData || parseFileBuffer(fileBuffer);

  const validLeads: LeadCreationAttributes[] = [];
  const skippedRows: { row: number; reason: string }[] = [];

  for (let [index, row] of rows.entries()) {
    try {

      // Ensure leadData exists
      if (!row.leadData || typeof row.leadData !== "object") {
        throw new Error("Missing or invalid 'leadData'");
      }

      // Convert Excel date to JS date
      if (row.leadData.date && typeof row.leadData.date === "number") {
        row.leadData.date = excelSerialDateToDate(row.leadData.date);
      }

      // Validate required fields
      if (!row.campaignName) {
        throw new Error("Missing required field: campaignName");
      }

      // Validate assignees
      if (row.assignees && !Array.isArray(row.assignees)) {
        throw new Error("Invalid assignees format (must be an array)");
      }

      // Prepare lead object
      const preparedLead: LeadCreationAttributes = {
        campaignName: row.campaignName,
        leadData: row.leadData,
        assignees: Array.isArray(row.assignees) ? row.assignees : [],
      };


      validLeads.push(preparedLead);
    } catch (err: any) {
      skippedRows.push({ row: index + 2, reason: err.message });
    }
  }



  let insertedCount = 0;

  // 🚀 INSERT DATA IN CHUNKS TO AVOID ECONNRESET / TIMEOUTS
  if (validLeads.length > 0) {
    try {
      const chunkSize = 200; // insert 200 at a time

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
