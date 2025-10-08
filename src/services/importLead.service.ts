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
//   console.log("📥 Starting Lead import...");
//   console.log("➡️ Received mappedData:", mappedData ? "Provided" : "Not Provided");

//   const rows = mappedData || parseFileBuffer(fileBuffer);
//   console.log(`➡️ Total rows to process: ${rows.length}`);

//   const validLeads: LeadCreationAttributes[] = [];
//   const skippedRows: { row: number; reason: string }[] = [];

//   for (let [index, row] of rows.entries()) {
//     try {
//       console.log(`\n🔎 Processing row ${index + 2}:`, row);

//       // ✅ Ensure leadData exists
//       if (!row.leadData || typeof row.leadData !== "object") {
//         throw new Error("Missing or invalid 'leadData'");
//       }

//       // ✅ Convert Excel serial date if needed
//       if (row.leadData.date && typeof row.leadData.date === "number") {
//         row.leadData.date = excelSerialDateToDate(row.leadData.date);
//         console.log(`   📅 Converted Excel date: ${row.leadData.date}`);
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

//       console.log("   ✅ Valid lead prepared:", preparedLead);

//       validLeads.push(preparedLead);
//     } catch (err: any) {
//       console.error(`   ❌ Error processing row ${index + 2}:`, err.message);
//       skippedRows.push({ row: index + 2, reason: err.message });
//     }
//   }

//   console.log("\n📊 Summary before DB insert:");
//   console.log("   ✅ Valid leads:", validLeads.length);
//   console.log("   ❌ Skipped rows:", skippedRows.length);

//   let insertedCount = 0;

//   if (validLeads.length > 0) {
//     try {
//       await Lead.bulkCreate(validLeads, { validate: true });
//       insertedCount = validLeads.length;
//       console.log(`\n✅ Successfully inserted ${insertedCount} leads into DB`);
//     } catch (dbError: any) {
//       console.error("❌ Database error during bulkCreate:", dbError);
//       skippedRows.push({
//         row: 0,
//         reason: `Database error: ${dbError.message}`,
//       });
//     }
//   } else {
//     console.warn("⚠️ No valid leads found. Skipping DB insert.");
//   }

//   console.log("\n📦 Import completed.");
//   console.log("   ✅ Imported:", insertedCount);
//   console.log("   ❌ Skipped:", skippedRows.length);

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
  console.log("📥 Starting Lead import...");
  console.log(
    "➡️ Received mappedData:",
    mappedData ? "Provided" : "Not Provided"
  );

  const rows = mappedData || parseFileBuffer(fileBuffer);
  console.log(`➡️ Total rows to process: ${rows.length}`);

  const validLeads: LeadCreationAttributes[] = [];
  const skippedRows: { row: number; reason: string }[] = [];

  for (let [index, row] of rows.entries()) {
    try {
      console.log(`\n🔎 Processing row ${index + 2}:`, row);

      // ✅ Ensure leadData exists
      if (!row.leadData || typeof row.leadData !== "object") {
        throw new Error("Missing or invalid 'leadData'");
      }

      // ✅ Convert Excel serial date if needed
      if (row.leadData.date && typeof row.leadData.date === "number") {
        row.leadData.date = excelSerialDateToDate(row.leadData.date);
        console.log(`   📅 Converted Excel date: ${row.leadData.date}`);
      }

      // ✅ Validate required fields
      if (!row.campaignName) {
        throw new Error("Missing required field: campaignName");
      }

      // ✅ Validate optional assignees (ensure it's an array)
      if (row.assignees && !Array.isArray(row.assignees)) {
        throw new Error("Invalid assignees format (must be an array)");
      }

      // ✅ Prepare Lead record
      const preparedLead: LeadCreationAttributes = {
        campaignName: row.campaignName,
        leadData: row.leadData,
        assignees: Array.isArray(row.assignees) ? row.assignees : [],
      };

      console.log("   ✅ Valid lead prepared:", preparedLead);

      validLeads.push(preparedLead);
    } catch (err: any) {
      console.error(`   ❌ Error processing row ${index + 2}:`, err.message);
      skippedRows.push({ row: index + 2, reason: err.message });
    }
  }

  console.log("\n📊 Summary before DB insert:");
  console.log("   ✅ Valid leads:", validLeads.length);
  console.log("   ❌ Skipped rows:", skippedRows.length);

  let insertedCount = 0;

  if (validLeads.length > 0) {
    try {
      await Lead.bulkCreate(validLeads, { validate: true });
      insertedCount = validLeads.length;
      console.log(`\n✅ Successfully inserted ${insertedCount} leads into DB`);

      // 📧 Setup SMTP config
      const smtpConfig = {
        host: process.env.DEFAULT_SMTP_HOST!,
        port: Number(process.env.DEFAULT_SMTP_PORT!),
        user: process.env.DEFAULT_SMTP_EMAIL!,
        pass: process.env.DEFAULT_SMTP_PASSWORD!,
      };

      // 🔔 Collect all unique emails from leadData
      const emailMap: Record<string, number> = {};
      for (const lead of validLeads) {
        const email = (lead.leadData as any)?.email;
        if (email) {
          emailMap[email] = (emailMap[email] || 0) + 1;
        }
      }

      if (Object.keys(emailMap).length > 0) {
        for (const [email, count] of Object.entries(emailMap)) {
          console.log(
            `📧 Sending summary email to ${email} for ${count} leads`
          );
          await sendEmail({
            smtp: smtpConfig,
            to: email,
            subject: "Lead Assignment",
            body: assignedBulkLeadEmailTemplate(count),
          });
        }
      } else {
        console.warn("⚠️ No lead emails found → skipping email notifications");
      }
    } catch (dbError: any) {
      console.error("❌ Database error during bulkCreate:", dbError);
      skippedRows.push({
        row: 0,
        reason: `Database error: ${dbError.message}`,
      });
    }
  } else {
    console.warn("⚠️ No valid leads found. Skipping DB insert.");
  }

  console.log("\n📦 Import completed.");
  console.log("   ✅ Imported:", insertedCount);
  console.log("   ❌ Skipped:", skippedRows.length);

  return {
    imported: insertedCount,
    skipped: skippedRows,
  };
};
