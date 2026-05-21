import { Response } from "express";
import { CustomRequest } from "../types/custom";
import * as PortalContentAdmin from "../services/portalContentAdmin.service";

export const listAnnouncementsController = async (
  req: CustomRequest,
  res: Response
): Promise<any> => {
  try {
    const brandId = req.query.brandId
      ? parseInt(String(req.query.brandId), 10)
      : undefined;
    const data = await PortalContentAdmin.listAnnouncementsAdmin(
      Number.isFinite(brandId) ? brandId : undefined
    );
    return res.status(200).json({ success: true, data });
  } catch (e: any) {
    return res.status(500).json({ success: false, message: e.message });
  }
};

export const createAnnouncementController = async (
  req: CustomRequest,
  res: Response
): Promise<any> => {
  try {
    const data = await PortalContentAdmin.createAnnouncementAdmin({
      ...req.body,
      createdBy: req.user!.id,
    });
    return res.status(201).json({ success: true, data });
  } catch (e: any) {
    return res.status(400).json({ success: false, message: e.message });
  }
};

export const updateAnnouncementController = async (
  req: CustomRequest,
  res: Response
): Promise<any> => {
  try {
    const id = parseInt(req.params.id, 10);
    const data = await PortalContentAdmin.updateAnnouncementAdmin(id, req.body);
    return res.status(200).json({ success: true, data });
  } catch (e: any) {
    return res.status(400).json({ success: false, message: e.message });
  }
};

export const deleteAnnouncementController = async (
  req: CustomRequest,
  res: Response
): Promise<any> => {
  try {
    const id = parseInt(req.params.id, 10);
    const data = await PortalContentAdmin.deleteAnnouncementAdmin(id);
    return res.status(200).json({ success: true, data });
  } catch (e: any) {
    return res.status(400).json({ success: false, message: e.message });
  }
};

export const listPopupsController = async (
  req: CustomRequest,
  res: Response
): Promise<any> => {
  try {
    const brandId = req.query.brandId
      ? parseInt(String(req.query.brandId), 10)
      : undefined;
    const data = await PortalContentAdmin.listPopupsAdmin(
      Number.isFinite(brandId) ? brandId : undefined
    );
    return res.status(200).json({ success: true, data });
  } catch (e: any) {
    return res.status(500).json({ success: false, message: e.message });
  }
};

export const createPopupController = async (
  req: CustomRequest,
  res: Response
): Promise<any> => {
  try {
    const data = await PortalContentAdmin.createPopupAdmin({
      ...req.body,
      createdBy: req.user!.id,
    });
    return res.status(201).json({ success: true, data });
  } catch (e: any) {
    return res.status(400).json({ success: false, message: e.message });
  }
};

export const updatePopupController = async (
  req: CustomRequest,
  res: Response
): Promise<any> => {
  try {
    const id = parseInt(req.params.id, 10);
    const data = await PortalContentAdmin.updatePopupAdmin(id, req.body);
    return res.status(200).json({ success: true, data });
  } catch (e: any) {
    return res.status(400).json({ success: false, message: e.message });
  }
};

export const deletePopupController = async (
  req: CustomRequest,
  res: Response
): Promise<any> => {
  try {
    const id = parseInt(req.params.id, 10);
    const data = await PortalContentAdmin.deletePopupAdmin(id);
    return res.status(200).json({ success: true, data });
  } catch (e: any) {
    return res.status(400).json({ success: false, message: e.message });
  }
};

export const setSaleProgressController = async (
  req: CustomRequest,
  res: Response
): Promise<any> => {
  try {
    const saleId = parseInt(req.params.saleId, 10);
    const data = await PortalContentAdmin.setSalePortalProgressAdmin(
      saleId,
      req.body
    );
    return res.status(200).json({ success: true, data });
  } catch (e: any) {
    return res.status(400).json({ success: false, message: e.message });
  }
};

export const listPortalBrandsController = async (
  _req: CustomRequest,
  res: Response
): Promise<any> => {
  try {
    const data = await PortalContentAdmin.listPortalBrandsAdmin();
    return res.status(200).json({ success: true, data });
  } catch (e: any) {
    return res.status(500).json({ success: false, message: e.message });
  }
};
