import { parseFileBuffer } from "../utils/fileParser";
import { mapClientLeadRow } from "../utils/clientLeadMapper";
import ClientLead, {
  ClientLeadCreationAttributes,
} from "../models/clientLead.model";
import Order from "../models/order.model";

// Helper function to convert Excel serial date to YYYY-MM-DD
const excelSerialDateToDate = (serial: number): string => {
  if (!serial || isNaN(serial)) return "";
  const excelEpoch = new Date(1899, 11, 31); // Excel epoch starts at 1899-12-31
  const daysInMs = serial * 24 * 60 * 60 * 1000;
  const date = new Date(excelEpoch.getTime() + daysInMs);
  return date.toISOString().split("T")[0]; // Return YYYY-MM-DD
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
      // Ensure row has leadData
      if (!row.leadData || typeof row.leadData !== "object") {
        throw new Error("Missing or invalid 'leadData'");
      }

      // Convert Excel serial date to proper date format if present
      if (row.leadData.date && typeof row.leadData.date === "number") {
        row.leadData.date = excelSerialDateToDate(row.leadData.date);
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

      // Validate order_id if provided
      if (row.order_id) {
        const orderExists = await Order.findByPk(row.order_id);
        if (!orderExists) {
          throw new Error(`Invalid order_id: ${row.order_id}`);
        }
      }

      // Map the row to ClientLead format
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

  if (validLeads.length > 0) {
    try {
      await ClientLead.bulkCreate(validLeads, {
        validate: true,
      });
    } catch (dbError: any) {
      console.error("Database error during bulkCreate:", dbError);
      skippedRows.push({
        row: 0,
        reason: `Database error: ${dbError.message}`,
      });
    }
  }

  return {
    imported: validLeads.length,
    skipped: skippedRows,
  };
};
