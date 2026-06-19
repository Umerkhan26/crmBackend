import { Response } from "express";
import { CustomRequest } from "../types/custom";
import * as PortalServiceAdmin from "../services/portalServiceAdmin.service";

export const listPortalServicesController = async (
  req: CustomRequest,
  res: Response
): Promise<any> => {
  try {
    const brandId = req.query.brandId
      ? parseInt(String(req.query.brandId), 10)
      : undefined;
    const page = parseInt(String(req.query.page || "1"), 10) || 1;
    const limit = parseInt(String(req.query.limit || "20"), 10) || 20;
    const data = await PortalServiceAdmin.listPortalServicesAdmin({
      brandId: Number.isFinite(brandId) ? brandId : undefined,
      page,
      limit,
    });
    return res.status(200).json({ success: true, data });
  } catch (e: any) {
    return res.status(500).json({ success: false, message: e.message });
  }
};

export const getPortalServiceController = async (
  req: CustomRequest,
  res: Response
): Promise<any> => {
  try {
    const id = parseInt(req.params.id, 10);
    const data = await PortalServiceAdmin.getPortalServiceAdmin(id);
    return res.status(200).json({ success: true, data });
  } catch (e: any) {
    const status = /not found/i.test(e.message) ? 404 : 500;
    return res.status(status).json({ success: false, message: e.message });
  }
};

export const createPortalServiceController = async (
  req: CustomRequest,
  res: Response
): Promise<any> => {
  try {
    const { brandId, name } = req.body || {};
    if (!brandId || !name?.trim()) {
      return res.status(400).json({
        success: false,
        message: "brandId and name are required",
      });
    }
    const data = await PortalServiceAdmin.createPortalServiceAdmin({
      ...req.body,
      createdBy: req.user!.id,
    });
    return res.status(201).json({ success: true, data });
  } catch (e: any) {
    return res.status(400).json({ success: false, message: e.message });
  }
};

export const updatePortalServiceController = async (
  req: CustomRequest,
  res: Response
): Promise<any> => {
  try {
    const id = parseInt(req.params.id, 10);
    const data = await PortalServiceAdmin.updatePortalServiceAdmin(id, req.body);
    return res.status(200).json({ success: true, data });
  } catch (e: any) {
    const status = /not found/i.test(e.message) ? 404 : 400;
    return res.status(status).json({ success: false, message: e.message });
  }
};

export const deletePortalServiceController = async (
  req: CustomRequest,
  res: Response
): Promise<any> => {
  try {
    const id = parseInt(req.params.id, 10);
    const data = await PortalServiceAdmin.deletePortalServiceAdmin(id);
    return res.status(200).json({ success: true, data });
  } catch (e: any) {
    const status = /not found/i.test(e.message) ? 404 : 400;
    return res.status(status).json({ success: false, message: e.message });
  }
};

export const listPortalServiceSubmissionsController = async (
  req: CustomRequest,
  res: Response
): Promise<any> => {
  try {
    const brandId = req.query.brandId
      ? parseInt(String(req.query.brandId), 10)
      : undefined;
    const serviceId = req.query.serviceId
      ? parseInt(String(req.query.serviceId), 10)
      : undefined;
    const page = parseInt(String(req.query.page || "1"), 10) || 1;
    const limit = parseInt(String(req.query.limit || "20"), 10) || 20;
    const status = req.query.status
      ? String(req.query.status)
      : undefined;

    const data = await PortalServiceAdmin.listPortalServiceSubmissionsAdmin({
      brandId: Number.isFinite(brandId) ? brandId : undefined,
      serviceId: Number.isFinite(serviceId) ? serviceId : undefined,
      status,
      page,
      limit,
    });
    return res.status(200).json({ success: true, data });
  } catch (e: any) {
    return res.status(500).json({ success: false, message: e.message });
  }
};

export const getPortalServiceSubmissionController = async (
  req: CustomRequest,
  res: Response
): Promise<any> => {
  try {
    const id = parseInt(req.params.id, 10);
    const data = await PortalServiceAdmin.getPortalServiceSubmissionAdmin(id);
    return res.status(200).json({ success: true, data });
  } catch (e: any) {
    const status = /not found/i.test(e.message) ? 404 : 500;
    return res.status(status).json({ success: false, message: e.message });
  }
};

export const updatePortalServiceSubmissionController = async (
  req: CustomRequest,
  res: Response
): Promise<any> => {
  try {
    const id = parseInt(req.params.id, 10);
    const data = await PortalServiceAdmin.updatePortalServiceSubmissionAdmin(
      id,
      req.body
    );
    return res.status(200).json({ success: true, data });
  } catch (e: any) {
    const status = /not found/i.test(e.message) ? 404 : 400;
    return res.status(status).json({ success: false, message: e.message });
  }
};
