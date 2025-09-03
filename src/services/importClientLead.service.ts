import { parseFileBuffer } from "../utils/fileParser";
import { mapClientLeadRow } from "../utils/clientLeadMapper";
import ClientLead, { ClientLeadCreationAttributes } from "../models/clientLead.model";
import Order from "../models/order.model";
import { sendEmail } from "../utils/email";

// Helper function to convert Excel serial date to YYYY-MM-DD
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
  console.log("Received mappedData:", mappedData);
  const rows = mappedData || parseFileBuffer(fileBuffer);
  console.log("Rows to process:", rows);

  const validLeads: ClientLeadCreationAttributes[] = [];
  const skippedRows: { row: number; reason: string }[] = [];

  for (let [index, row] of rows.entries()) {
    try {
      if (!row.leadData || typeof row.leadData !== "object") {
        throw new Error("Missing or invalid 'leadData'");
      }

      if (row.leadData.date && typeof row.leadData.date === "number") {
        row.leadData.date = excelSerialDateToDate(row.leadData.date);
      }

      if (
        !row.leadData.first_name ||
        !row.leadData.last_name ||
        !row.leadData.agent_name
      ) {
        throw new Error(
          "Missing required fields: first_name, last_name, or agent_name"
        );
      }

      if (row.order_id) {
        const orderExists = await Order.findByPk(row.order_id);
        if (!orderExists) {
          throw new Error(`Invalid order_id: ${row.order_id}`);
        }
      }

      const lead = mapClientLeadRow(row);

      validLeads.push({
        ...lead,
        created_by: createdBy,
        order_id: row.order_id || null,
      } as ClientLeadCreationAttributes);
    } catch (err: any) {
      console.error(`Error processing row ${index + 2}:`, err.message);
      skippedRows.push({ row: index + 2, reason: err.message });
    }
  }

  console.log("Valid leads to insert:", validLeads);
  console.log("Skipped rows:", skippedRows);

  let insertedCount = 0;

  if (validLeads.length > 0) {
    try {
      await ClientLead.bulkCreate(validLeads, { validate: true });
      insertedCount = validLeads.length;

      console.log(`✅ Successfully inserted ${insertedCount} leads`);

      // 📧 Send one summary email (to uploader or leads, depending on use case)
      const smtpConfig = {
        host: process.env.DEFAULT_SMTP_HOST!,
        port: Number(process.env.DEFAULT_SMTP_PORT!),
        user: process.env.DEFAULT_SMTP_EMAIL!,
        pass: process.env.DEFAULT_SMTP_PASSWORD!,
      };

      // Option A: Notify uploader
      await sendEmail({
        smtp: smtpConfig,
        to: process.env.NOTIFY_EMAIL || "uploader@example.com", // fallback
        subject: "Lead Import Summary",
        body: `✅ Successfully imported ${insertedCount} leads.\n❌ Skipped: ${skippedRows.length} rows.`,
      });

      // Option B: Notify each lead by email (if email present)
      for (const lead of validLeads) {
        if (lead.leadData && lead.leadData.email) {
          await sendEmail({
            smtp: smtpConfig,
            to: lead.leadData.email,
            subject: "You Have Been Assigned a Lead",
            body: `You have been assigned lead ID ${lead.id || "N/A"}.`,
          });
        }
      }
    } catch (dbError: any) {
      console.error("❌ Database error during bulkCreate:", dbError);
      skippedRows.push({
        row: 0,
        reason: `Database error: ${dbError.message}`,
      });
    }
  }

  return {
    imported: insertedCount,
    skipped: skippedRows,
  };
};
