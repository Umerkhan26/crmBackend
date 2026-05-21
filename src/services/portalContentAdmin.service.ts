import { Op } from "sequelize";
import Brand from "../models/brand.model";
import PortalAnnouncement from "../models/portalAnnouncement.model";
import PortalPopup from "../models/portalPopup.model";
import ProductSale from "../models/product.model";
import CustomerAccount from "../models/customerAccount.model";

export const listAnnouncementsAdmin = async (brandId?: number) => {
  const where: any = {};
  if (brandId) where.brandId = brandId;
  return PortalAnnouncement.findAll({
    where,
    order: [["createdAt", "DESC"]],
  });
};

export const createAnnouncementAdmin = async (payload: {
  brandId: number;
  title: string;
  body?: string;
  linkUrl?: string;
  status?: string;
  startsAt?: string | Date | null;
  endsAt?: string | Date | null;
  createdBy: number;
}) => {
  const brand = await Brand.findByPk(payload.brandId);
  if (!brand) throw new Error("Brand not found");
  return PortalAnnouncement.create({
    brandId: payload.brandId,
    title: payload.title,
    body: payload.body || null,
    linkUrl: payload.linkUrl || null,
    status: (payload.status as any) || "draft",
    startsAt: payload.startsAt ? new Date(payload.startsAt) : null,
    endsAt: payload.endsAt ? new Date(payload.endsAt) : null,
    createdBy: payload.createdBy,
  });
};

export const updateAnnouncementAdmin = async (
  id: number,
  payload: Partial<{
    title: string;
    body: string;
    linkUrl: string;
    status: string;
    startsAt: string | Date | null;
    endsAt: string | Date | null;
  }>
) => {
  const row = await PortalAnnouncement.findByPk(id);
  if (!row) throw new Error("Announcement not found");
  const update: any = { ...payload };
  if (payload.startsAt !== undefined) {
    update.startsAt = payload.startsAt ? new Date(payload.startsAt) : null;
  }
  if (payload.endsAt !== undefined) {
    update.endsAt = payload.endsAt ? new Date(payload.endsAt) : null;
  }
  await row.update(update);
  return row;
};

export const deleteAnnouncementAdmin = async (id: number) => {
  const row = await PortalAnnouncement.findByPk(id);
  if (!row) throw new Error("Announcement not found");
  await row.destroy();
  return { deleted: true };
};

export const listPopupsAdmin = async (brandId?: number) => {
  const where: any = {};
  if (brandId) where.brandId = brandId;
  return PortalPopup.findAll({
    where,
    order: [
      ["priority", "DESC"],
      ["createdAt", "DESC"],
    ],
  });
};

export const createPopupAdmin = async (payload: {
  brandId: number;
  title: string;
  body?: string;
  imageUrl?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  status?: string;
  priority?: number;
  startsAt?: string | Date | null;
  endsAt?: string | Date | null;
  createdBy: number;
}) => {
  const brand = await Brand.findByPk(payload.brandId);
  if (!brand) throw new Error("Brand not found");
  return PortalPopup.create({
    brandId: payload.brandId,
    title: payload.title,
    body: payload.body || null,
    imageUrl: payload.imageUrl || null,
    ctaLabel: payload.ctaLabel || null,
    ctaUrl: payload.ctaUrl || null,
    status: (payload.status as any) || "draft",
    priority: payload.priority ?? 0,
    startsAt: payload.startsAt ? new Date(payload.startsAt) : null,
    endsAt: payload.endsAt ? new Date(payload.endsAt) : null,
    createdBy: payload.createdBy,
  });
};

export const updatePopupAdmin = async (
  id: number,
  payload: Partial<{
    title: string;
    body: string;
    imageUrl: string;
    ctaLabel: string;
    ctaUrl: string;
    status: string;
    priority: number;
    startsAt: string | Date | null;
    endsAt: string | Date | null;
  }>
) => {
  const row = await PortalPopup.findByPk(id);
  if (!row) throw new Error("Popup not found");
  const update: any = { ...payload };
  if (payload.startsAt !== undefined) {
    update.startsAt = payload.startsAt ? new Date(payload.startsAt) : null;
  }
  if (payload.endsAt !== undefined) {
    update.endsAt = payload.endsAt ? new Date(payload.endsAt) : null;
  }
  await row.update(update);
  return row;
};

export const deletePopupAdmin = async (id: number) => {
  const row = await PortalPopup.findByPk(id);
  if (!row) throw new Error("Popup not found");
  await row.destroy();
  return { deleted: true };
};

/** Staff: set order progress shown in customer portal */
export const setSalePortalProgressAdmin = async (
  saleId: number,
  progress: { label?: string; percent?: number; steps?: unknown[] }
) => {
  const sale = await ProductSale.findByPk(saleId);
  if (!sale) throw new Error("Sale not found");
  const existing = (sale as any).portalProgress || {};
  const next = {
    ...existing,
    label: progress.label ?? existing.label ?? "In progress",
    percent: progress.percent ?? existing.percent ?? 0,
    steps: progress.steps ?? existing.steps ?? [],
    updatedAt: new Date().toISOString(),
  };
  await sale.update({ portalProgress: next } as any);
  return { saleId, progress: next };
};

export const listPortalBrandsAdmin = async () => {
  return Brand.findAll({
    where: { status: "active" },
    attributes: [
      "id",
      "name",
      "slug",
      "subdomain",
      "customerPortalUrl",
      "salesFormConfig",
    ],
    order: [["name", "ASC"]],
  });
};
