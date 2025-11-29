import { Request, Response } from "express";
import { importLeadsFromFile } from "../services/importLead.service";

export const importLeads = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const file = req.file;
    const mappedData = req.body.mappedData
      ? JSON.parse(req.body.mappedData)
      : undefined;

    if (!file && !mappedData) {
      return res
        .status(400)
        .json({ message: "No file uploaded and no mappedData provided" });
    }

    const result = await importLeadsFromFile(
      file ? file.buffer : Buffer.from(""),
      mappedData
    );

    res.status(200).json({
      message: "Lead import completed",
      ...result,
    });
  } catch (error: any) {
    res.status(500).json({
      message: "Failed to import leads",
      error: error.message,
    });
  }
};
