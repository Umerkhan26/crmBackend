// controllers/lead.controller.ts
import { Request, Response } from "express";
import { importLeadsFromFile } from "../services/importLead.service";

export const importLeads = async (req: Request, res: Response):Promise<any> => {
  try {
    // file comes from multer upload middleware
    const file = req.file;

    if (!file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const result = await importLeadsFromFile(file.buffer);

    res.status(200).json({
      message: "Lead import completed",
      ...result,
    });
  } catch (error: any) {
    console.error("❌ Error importing leads:", error);
    res.status(500).json({
      message: "Failed to import leads",
      error: error.message,
    });
  }
};
