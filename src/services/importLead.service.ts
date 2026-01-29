
import { parseFileBuffer } from "../utils/fileParser";
import Lead, { LeadCreationAttributes } from "../models/lead.model";
import { sendEmail } from "../utils/email";
import { assignedBulkLeadEmailTemplate } from "../Templetes/assignedBulkLeadEmail";
import { normalizePhone } from "../utils/phoneNormalizer";
import { Op, where, fn, col } from "sequelize";


const excelSerialDateToDate = (serial: number): string => {
  if (!serial || isNaN(serial)) return "";
  const excelEpoch = new Date(1899, 11, 31);
  const daysInMs = serial * 24 * 60 * 60 * 1000;
  const date = new Date(excelEpoch.getTime() + daysInMs);
  return date.toISOString().split("T")[0];
};


/**
 * Check if a lead with the same phone number already exists in the database
 */
const checkDuplicateLeadInDB = async (
  phoneNumber: string | null | undefined,
  campaignName?: string
): Promise<boolean> => {
  if (!phoneNumber) return false;

  const normalizedPhone = normalizePhone(phoneNumber);
  if (!normalizedPhone) return false;

  try {
    const whereCondition: any = {
      [Op.and]: [
        where(
          fn("JSON_EXTRACT", col("leadData"), "$.number"),
          normalizedPhone
        )
      ]
    };

    if (campaignName) {
      whereCondition.campaignName = campaignName;
    }

    const existingLead = await Lead.findOne({
      where: whereCondition,
      attributes: ["id"], // Only fetch id for performance
    });

    return existingLead !== null;
  } catch (error: any) {
    console.error("Error checking duplicate lead:", error);
    // Return false to allow creation to proceed if check fails
    return false;
  }
};

export const importLeadsFromFile = async (
  fileBuffer: Buffer,
  mappedData?: any[],
  userId?: number // Add userId to track who imported the leads
) => {


  const rows = mappedData || parseFileBuffer(fileBuffer);

  const validLeads: LeadCreationAttributes[] = [];
  const skippedRows: { row: number; reason: string }[] = [];
  const seenPhones = new Set<string>(); // Track phones in current batch to avoid duplicates within the file

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

      // Check for duplicate phone number
      const phoneNumber = row.leadData?.number || row.leadData?.phone_number || null;
      const normalizedPhone = normalizePhone(phoneNumber);

      // Check if duplicate within the current file
      if (normalizedPhone && seenPhones.has(normalizedPhone)) {
        throw new Error(`Duplicate phone number in file: ${phoneNumber}`);
      }

      // Check if duplicate exists in database
      if (normalizedPhone) {
        const isDuplicate = await checkDuplicateLeadInDB(phoneNumber, row.campaignName);
        if (isDuplicate) {
          throw new Error(`Duplicate phone number already exists in database: ${phoneNumber}`);
        }
        seenPhones.add(normalizedPhone);
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
