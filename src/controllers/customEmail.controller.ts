import { Request, Response } from "express";
import { sendCustomEmailService } from "../services/customEmail.service";
import User from "../models/user.model";
import Role from "../models/role.model";

export const sendCustomEmailController = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    // Get admin user from request (set by verifyToken middleware)
    const adminUserId = (req as any).user?.id;

    if (!adminUserId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    // Verify admin is actually an admin
    const admin = await User.findByPk(adminUserId, {
      include: {
        model: Role,
      },
    }) as any;

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "Admin user not found",
      });
    }

    const roleName = admin.Role?.name?.toLowerCase() || "";
    const isAdmin = roleName === "admin" || roleName === "adminn";

    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Only admins can send custom emails",
      });
    }

    // Get request body
    const { recipientUserId, subject, body } = req.body;

    // Validate required fields
    if (!recipientUserId) {
      return res.status(400).json({
        success: false,
        message: "Recipient user ID is required",
      });
    }

    if (!subject || !subject.trim()) {
      return res.status(400).json({
        success: false,
        message: "Subject is required",
      });
    }

    if (!body || !body.trim()) {
      return res.status(400).json({
        success: false,
        message: "Body content is required",
      });
    }

    // Send email
    const result = await sendCustomEmailService({
      recipientUserId: parseInt(recipientUserId),
      subject: subject.trim(),
      body: body.trim(),
      adminUserId,
    });

    return res.status(200).json({
      success: true,
      message: result.message,
      data: {
        recipientEmail: result.recipientEmail,
      },
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to send custom email",
    });
  }
};

