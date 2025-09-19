// import { Request, Response } from "express";
// import { importClientLeadsFromFile } from "../services/importClientLead.service";
// import { CustomRequest } from "../types/custom";

// export const importClientLeadsController = async (
//   req: CustomRequest,
//   res: Response
// ): Promise<any> => {
//   if (!req.file || !req.file.buffer) {
//     return res
//       .status(400)
//       .json({ success: false, message: "No file uploaded" });
//   }

//   const userId = req.user?.id;
//   if (!userId) {
//     return res.status(401).json({ success: false, message: "Unauthorized" });
//   }

//   try {
//     const mappedData = req.body.mappedData
//       ? JSON.parse(req.body.mappedData)
//       : undefined;
//     const orderId = req.body.order_id ? parseInt(req.body.order_id) : undefined;

//     console.log("Received order_id:", orderId);
//     console.log("Received mappedData:", mappedData);

//     // Add order_id to each leadData object if provided
//     if (orderId && mappedData) {
//       mappedData.forEach((row: any) => {
//         row.order_id = orderId;
//       });
//     }

//     const result = await importClientLeadsFromFile(
//       req.file.buffer,
//       userId,
//       mappedData
//     );

//     return res.status(201).json({
//       success: true,
//       message: `${result.imported} client lead(s) imported successfully.`,
//       imported: result.imported,
//       skipped: result.skipped,
//     });
//   } catch (error: any) {
//     console.error("❌ Client Lead Import error:", error);
//     return res.status(500).json({
//       success: false,
//       message:
//         error.message || "Something went wrong during client lead import",
//     });
//   }
// };


import { Request, Response } from "express";
import { importClientLeadsFromFile } from "../services/importClientLead.service";
import { CustomRequest } from "../types/custom";

export const importClientLeadsController = async (
  req: CustomRequest,
  res: Response
): Promise<any> => {
  if (!req.file || !req.file.buffer) {
    return res
      .status(400)
      .json({ success: false, message: "No file uploaded" });
  }

  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  try {
    const mappedData = req.body.mappedData
      ? JSON.parse(req.body.mappedData)
      : undefined;

    const orderId = req.body.order_id ? parseInt(req.body.order_id) : undefined;
    const campaignName = req.body.campaignName || undefined;

    console.log("Received order_id:", orderId);
    console.log("Received campaignName:", campaignName);
    console.log("Received mappedData:", mappedData);

    // Add order_id and campaignName to each leadData object if provided
    if (mappedData) {
      mappedData.forEach((row: any) => {
        if (orderId) row.order_id = orderId;
        if (campaignName) row.leadData = { ...row.leadData, campaignName };
      });
    }

    const result = await importClientLeadsFromFile(
      req.file.buffer,
      userId,
      mappedData
    );

    return res.status(201).json({
      success: true,
      message: `${result.imported} client lead(s) imported successfully.`,
      imported: result.imported,
      skipped: result.skipped,
    });
  } catch (error: any) {
    console.error("❌ Client Lead Import error:", error);
    return res.status(500).json({
      success: false,
      message:
        error.message || "Something went wrong during client lead import",
    });
  }
};
