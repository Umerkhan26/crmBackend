import { Response } from "express";
import { CustomRequest } from "../types/custom";
import * as CustomerEmailTypeService from "../services/customerEmailType.service";

const toPublic = (row: {
  id: number;
  slug: string;
  label: string;
  mailboxPrefix: string;
  description?: string | null;
  sortOrder: number;
  isActive: boolean;
  flowDefaults?: unknown;
}) => ({
  id: row.id,
  slug: row.slug,
  emailType: row.slug,
  label: row.label,
  mailboxPrefix: row.mailboxPrefix,
  description: row.description,
  sortOrder: row.sortOrder,
  isActive: row.isActive,
  flowDefaults: Array.isArray(row.flowDefaults) ? row.flowDefaults : [],
});

export const listCustomerEmailTypesAdminController = async (
  req: CustomRequest,
  res: Response
): Promise<any> => {
  try {
    const includeInactive = req.query.includeInactive === "true";
    const data = await CustomerEmailTypeService.listCustomerEmailTypes({
      includeInactive,
    });
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error?.message || "Failed to list email types",
    });
  }
};

export const listCustomerEmailFlowOptionsController = async (
  _req: CustomRequest,
  res: Response
): Promise<any> => {
  return res.status(200).json({
    success: true,
    data: CustomerEmailTypeService.CUSTOMER_EMAIL_FLOW_OPTIONS,
  });
};

export const createCustomerEmailTypeController = async (
  req: CustomRequest,
  res: Response
): Promise<any> => {
  try {
    const created = await CustomerEmailTypeService.createCustomerEmailType(
      req.body
    );
    return res.status(201).json({
      success: true,
      message: "Email type created",
      data: toPublic(created),
    });
  } catch (error: any) {
    const msg = error?.message || "Failed to create email type";
    const status = /required|exists|slug/i.test(msg) ? 400 : 500;
    return res.status(status).json({ success: false, message: msg });
  }
};

export const updateCustomerEmailTypeController = async (
  req: CustomRequest,
  res: Response
): Promise<any> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ success: false, message: "Invalid id" });
    }
    const updated = await CustomerEmailTypeService.updateCustomerEmailType(
      id,
      req.body
    );
    return res.status(200).json({
      success: true,
      message: "Email type updated",
      data: toPublic(updated),
    });
  } catch (error: any) {
    const msg = error?.message || "Failed to update email type";
    const status = /not found/i.test(msg) ? 404 : 500;
    return res.status(status).json({ success: false, message: msg });
  }
};

export const deactivateCustomerEmailTypeController = async (
  req: CustomRequest,
  res: Response
): Promise<any> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ success: false, message: "Invalid id" });
    }
    const row = await CustomerEmailTypeService.deactivateCustomerEmailType(id);
    return res.status(200).json({
      success: true,
      message: "Email type deactivated",
      data: toPublic(row),
    });
  } catch (error: any) {
    const msg = error?.message || "Failed to deactivate email type";
    const status = /not found|cannot|required/i.test(msg) ? 400 : 500;
    return res.status(status).json({ success: false, message: msg });
  }
};
