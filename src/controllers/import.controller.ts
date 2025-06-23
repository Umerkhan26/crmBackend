import { Request, Response } from "express";
import { importOrdersFromFile } from "../services/import.service";
import { CustomRequest } from "../types/custom";

export const importOrdersController = async (req: CustomRequest, res: Response):Promise<any> => {
  if (!req.file || !req.file.buffer) {
    return res.status(400).json({ success: false, message: "No file uploaded" });
  }

  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

  try {
    const result = await importOrdersFromFile(req.file.buffer, userId);

    return res.status(201).json({
      success: true,
      message: `${result.imported} orders imported successfully.`,
      skipped: result.skipped,
    });
  } catch (error: any) {
    console.error("❌ Import error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Something went wrong during import",
    });
  }
};
