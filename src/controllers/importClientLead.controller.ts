import { Request, Response } from "express";
import { importClientLeadsFromFile } from "../services/importClientLead.service";
import { CustomRequest } from "../types/custom";

export const importClientLeadsController = async (req: CustomRequest, res: Response): Promise<any> => {
  if (!req.file || !req.file.buffer) {
    return res.status(400).json({ success: false, message: "No file uploaded" });
  }

  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  try {
    const result = await importClientLeadsFromFile(req.file.buffer, userId);

    return res.status(201).json({
      success: true,
      message: `${result.imported} client lead(s) imported successfully.`,
      skipped: result.skipped.length > 0 ? result.skipped : undefined,
    });
  } catch (error: any) {
    console.error("❌ Client Lead Import error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Something went wrong during client lead import",
    });
  }
};
