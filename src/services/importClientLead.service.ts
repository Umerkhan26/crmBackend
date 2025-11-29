

import { parseFileBuffer } from "../utils/fileParser";
import { mapClientLeadRow } from "../utils/clientLeadMapper";
import ClientLead, {
  ClientLeadCreationAttributes,
} from "../models/clientLead.model";
import Order from "../models/order.model";
import { sendEmail } from "../utils/email";
import { assignedBulkLeadEmailTemplate } from "../Templetes/assignedBulkLeadEmail";
import Campaign from "../models/campaign.model";


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


  const rows = mappedData || parseFileBuffer(fileBuffer);

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

      if (!row.leadData.campaignName) {
      }

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

      const lead = mapClientLeadRow(row);
      const preparedLead: ClientLeadCreationAttributes = {
        ...lead,
        created_by: createdBy,
        order_id: row.order_id || null,
        campaign_id: row.campaign_id || null,
        leadData: {
          ...row.leadData,
          campaignName: row.leadData.campaignName || null,
        },
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

        await ClientLead.bulkCreate(chunk, { validate: true });
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
