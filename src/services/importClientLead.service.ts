// import { parseFileBuffer } from "../utils/fileParser";
// import { mapClientLeadRow } from "../utils/clientLeadMapper";
// import ClientLead, { ClientLeadCreationAttributes } from "../models/clientLead.model";
// import Order from "../models/order.model";
// import { sendEmail } from "../utils/email";
// import { assignedBulkLeadEmailTemplate } from "../Templetes/assignedBulkLeadEmail";

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

// export const importClientLeadsFromFile = async (
//   fileBuffer: Buffer,
//   createdBy: number,
//   mappedData?: any[]
// ) => {
//   console.log("📥 Starting client lead import...");
//   console.log("➡️ Created By (userId):", createdBy);
//   console.log("➡️ Received mappedData:", mappedData ? "Provided" : "Not Provided");

//   // ✅ Use mappedData if passed, otherwise parse file
//   const rows = mappedData || parseFileBuffer(fileBuffer);
//   console.log(`➡️ Total rows to process: ${rows.length}`);

//   const validLeads: ClientLeadCreationAttributes[] = [];
//   const skippedRows: { row: number; reason: string }[] = [];

//   for (let [index, row] of rows.entries()) {
//     try {
//       console.log(`\n🔎 Processing row ${index + 2}:`, row);

//       if (!row.leadData || typeof row.leadData !== "object") {
//         throw new Error("Missing or invalid 'leadData'");
//       }

//       // Convert Excel serial date to string if needed
//       if (row.leadData.date && typeof row.leadData.date === "number") {
//         row.leadData.date = excelSerialDateToDate(row.leadData.date);
//         console.log(`   📅 Converted Excel date: ${row.leadData.date}`);
//       }

//       // Validate required fields
//       if (
//         !row.leadData.first_name ||
//         !row.leadData.last_name ||
//         !row.leadData.agent_name
//       ) {
//         throw new Error(
//           "Missing required fields: first_name, last_name, or agent_name"
//         );
//       }

//       // Check order validity
//       if (row.order_id) {
//         const orderExists = await Order.findByPk(row.order_id);
//         if (!orderExists) {
//           throw new Error(`Invalid order_id: ${row.order_id}`);
//         }
//       }

//       // Map and prepare lead
//       const lead = mapClientLeadRow(row);
//       const preparedLead: ClientLeadCreationAttributes = {
//         ...lead,
//         created_by: createdBy,
//         order_id: row.order_id || null,
//         leadData: row.leadData as Record<string, any>, // ✅ force required
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
//       await ClientLead.bulkCreate(validLeads, { validate: true });
//       insertedCount = validLeads.length;
//       console.log(`\n✅ Successfully inserted ${insertedCount} leads into DB`);

//       // 📧 Setup SMTP config
//       const smtpConfig = {
//         host: process.env.DEFAULT_SMTP_HOST!,
//         port: Number(process.env.DEFAULT_SMTP_PORT!),
//         user: process.env.DEFAULT_SMTP_EMAIL!,
//         pass: process.env.DEFAULT_SMTP_PASSWORD!,
//       };

//       // 🔔 Collect all unique emails from leadData
//       const emailMap: Record<string, number> = {};
//       for (const lead of validLeads) {
//         const email = (lead.leadData as any)?.email;
//         if (email) {
//           emailMap[email] = (emailMap[email] || 0) + 1;
//         }
//       }

//       if (Object.keys(emailMap).length > 0) {
//         for (const [email, count] of Object.entries(emailMap)) {
//           console.log(`📧 Sending summary email to ${email} for ${count} leads`);
//           await sendEmail({
//             smtp: smtpConfig,
//             to: email,
//       subject: "Lead Assignment",
//       body: assignedBulkLeadEmailTemplate(count), // 👈 new template
//           });
//         }
//       } else {
//         console.warn("⚠️ No lead emails found → skipping email notifications");
//       }
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
import { mapClientLeadRow } from "../utils/clientLeadMapper";
import ClientLead, {
  ClientLeadCreationAttributes,
} from "../models/clientLead.model";
import Order from "../models/order.model";
import { sendEmail } from "../utils/email";
import { assignedBulkLeadEmailTemplate } from "../Templetes/assignedBulkLeadEmail";
import Campaign from "../models/campaign.model";

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

export const importClientLeadsFromFile = async (
  fileBuffer: Buffer,
  createdBy: number,
  mappedData?: any[]
) => {
  console.log("📥 Starting client lead import...");
  console.log("➡️ Created By (userId):", createdBy);
  console.log(
    "➡️ Received mappedData:",
    mappedData ? "Provided" : "Not Provided"
  );

  // ✅ Use mappedData if passed, otherwise parse file
  const rows = mappedData || parseFileBuffer(fileBuffer);
  console.log(`➡️ Total rows to process: ${rows.length}`);

  const validLeads: ClientLeadCreationAttributes[] = [];
  const skippedRows: { row: number; reason: string }[] = [];

  for (let [index, row] of rows.entries()) {
    try {
      console.log(`\n🔎 Processing row ${index + 2}:`, row);

      if (!row.leadData || typeof row.leadData !== "object") {
        throw new Error("Missing or invalid 'leadData'");
      }

      // Convert Excel serial date to string if needed
      if (row.leadData.date && typeof row.leadData.date === "number") {
        row.leadData.date = excelSerialDateToDate(row.leadData.date);
        console.log(`   📅 Converted Excel date: ${row.leadData.date}`);
      }

      // Validate required fields
      if (
        !row.leadData.first_name ||
        !row.leadData.last_name ||
        !row.leadData.agent_name
      ) {
        throw new Error(
          "Missing required fields: first_name, last_name, or agent_name"
        );
      }

      // ✅ CampaignName check (optional but included if available)
      if (!row.leadData.campaignName) {
        console.warn(`   ⚠️ No campaignName provided in row ${index + 2}`);
      }

      // Check order validity
      if (row.order_id) {
        const orderExists = await Order.findByPk(row.order_id);
        if (!orderExists) {
          throw new Error(`Invalid order_id: ${row.order_id}`);
        }
      }

      if (row.campaign_id) {
        const campaignExists = await Campaign.findByPk(row.campaign_id);
        if (!campaignExists) {
          throw new Error(`Invalid campaign_id: ${row.campaign_id}`);
        }
      }

      // Map and prepare lead
      const lead = mapClientLeadRow(row);
      const preparedLead: ClientLeadCreationAttributes = {
        ...lead,
        created_by: createdBy,
        order_id: row.order_id || null,
        campaign_id: row.campaign_id || null,
        leadData: {
          ...row.leadData,
          campaignName: row.leadData.campaignName || null, // 👈 ensure campaignName is stored
        },
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
      await ClientLead.bulkCreate(validLeads, { validate: true });
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
            body: assignedBulkLeadEmailTemplate(count), // 👈 new template
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
