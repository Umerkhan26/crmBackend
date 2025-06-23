import * as XLSX from "xlsx";

/**
 * Parses an uploaded Excel or CSV file buffer and returns array of row objects.
 */
export const parseFileBuffer = (buffer: Buffer): any[] => {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: "" }); // defval prevents undefined
  return jsonData;
};
