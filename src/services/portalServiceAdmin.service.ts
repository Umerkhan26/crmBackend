import { Op } from "sequelize";
import "../models/associations";
import Brand from "../models/brand.model";
import PortalService from "../models/portalService.model";
import PortalServiceSubmission from "../models/portalServiceSubmission.model";
import CustomerAccount from "../models/customerAccount.model";
import PortalCustomer from "../models/portalCustomer.model";
import {
  normalizeFormData,
  normalizeFormFields,
  slugifyServiceName,
} from "../types/portalServiceForm";

const serializePortalService = (row: PortalService) => {
  const json = row.toJSON() as unknown as Record<string, unknown>;
  return {
    ...json,
    formFields: normalizeFormFields(json.formFields),
  };
};

const serializePortalSubmission = (row: PortalServiceSubmission) => {
  const json = row.toJSON() as unknown as Record<string, unknown>;
  const service = json.service as Record<string, unknown> | undefined;

  return {
    ...json,
    formData: normalizeFormData(json.formData),
    service: service
      ? {
          ...service,
          formFields: normalizeFormFields(service.formFields),
        }
      : service,
  };
};

const ensureUniqueSlug = async (
  brandId: number,
  baseSlug: string,
  excludeId?: number
) => {
  let slug = baseSlug || "service";
  let suffix = 0;

  while (true) {
    const candidate = suffix ? `${slug}-${suffix}` : slug;
    const where: Record<string, unknown> = { brandId, slug: candidate };
    if (excludeId) where.id = { [Op.ne]: excludeId };

    const existing = await PortalService.findOne({ where });
    if (!existing) return candidate;
    suffix += 1;
  }
};

export const listPortalServicesAdmin = async (brandId?: number) => {
  const where: Record<string, unknown> = {};
  if (brandId) where.brandId = brandId;

  const rows = await PortalService.findAll({
    where,
    order: [
      ["sortOrder", "ASC"],
      ["id", "ASC"],
    ],
  });

  return rows.map(serializePortalService);
};

export const getPortalServiceAdmin = async (id: number) => {
  const row = await PortalService.findByPk(id);
  if (!row) throw new Error("Portal service not found");
  return serializePortalService(row);
};

export const createPortalServiceAdmin = async (payload: {
  brandId: number;
  name: string;
  slug?: string;
  shortDescription?: string;
  detailedContent?: string;
  iconUrl?: string;
  sortOrder?: number;
  status?: string;
  formFields?: unknown;
  createdBy: number;
}) => {
  const brand = await Brand.findByPk(payload.brandId);
  if (!brand) throw new Error("Brand not found");

  const name = payload.name.trim();
  if (!name) throw new Error("Service name is required");

  const baseSlug = slugifyServiceName(payload.slug || name);
  const slug = await ensureUniqueSlug(payload.brandId, baseSlug);
  const formFields = normalizeFormFields(payload.formFields);

  const maxOrder = (await PortalService.max("sortOrder", {
    where: { brandId: payload.brandId },
  })) as number | null;

  const created = await PortalService.create({
    brandId: payload.brandId,
    name,
    slug,
    shortDescription: payload.shortDescription?.trim() || null,
    detailedContent: payload.detailedContent?.trim() || null,
    iconUrl: payload.iconUrl?.trim() || null,
    sortOrder: payload.sortOrder ?? (maxOrder != null ? maxOrder + 1 : 1),
    status: (payload.status as any) || "draft",
    formFields,
    createdBy: payload.createdBy,
  });

  return serializePortalService(created);
};

export const updatePortalServiceAdmin = async (
  id: number,
  payload: Partial<{
    name: string;
    slug: string;
    shortDescription: string;
    detailedContent: string;
    iconUrl: string;
    sortOrder: number;
    status: string;
    formFields: unknown;
  }>
) => {
  const row = await PortalService.findByPk(id);
  if (!row) throw new Error("Portal service not found");

  const update: Record<string, unknown> = {};

  if (payload.name != null) {
    const name = payload.name.trim();
    if (!name) throw new Error("Service name is required");
    update.name = name;
  }

  if (payload.slug != null || payload.name != null) {
    const baseSlug = slugifyServiceName(
      payload.slug || String(update.name || row.name)
    );
    update.slug = await ensureUniqueSlug(row.brandId, baseSlug, row.id);
  }

  if (payload.shortDescription !== undefined) {
    update.shortDescription = payload.shortDescription?.trim() || null;
  }
  if (payload.detailedContent !== undefined) {
    update.detailedContent = payload.detailedContent?.trim() || null;
  }
  if (payload.iconUrl !== undefined) {
    update.iconUrl = payload.iconUrl?.trim() || null;
  }
  if (payload.sortOrder != null) update.sortOrder = payload.sortOrder;
  if (payload.status != null) update.status = payload.status;
  if (payload.formFields !== undefined) {
    update.formFields = normalizeFormFields(payload.formFields);
  }

  await row.update(update);
  return serializePortalService(await row.reload());
};

export const deletePortalServiceAdmin = async (id: number) => {
  const row = await PortalService.findByPk(id);
  if (!row) throw new Error("Portal service not found");
  await row.destroy();
  return { deleted: true };
};

export const listPortalServiceSubmissionsAdmin = async ({
  brandId,
  serviceId,
  status,
  page = 1,
  limit = 20,
}: {
  brandId?: number;
  serviceId?: number;
  status?: string;
  page?: number;
  limit?: number;
}) => {
  const safePage = Math.max(1, page);
  const safeLimit = Math.min(50, Math.max(5, limit));
  const offset = (safePage - 1) * safeLimit;

  const where: Record<string, unknown> = {};
  if (brandId) where.brandId = brandId;
  if (serviceId) where.serviceId = serviceId;
  if (status) where.status = status;

  const { rows, count } = await PortalServiceSubmission.findAndCountAll({
    where,
    order: [["submittedAt", "DESC"]],
    limit: safeLimit,
    offset,
    include: [
      {
        model: PortalService,
        as: "service",
        attributes: ["id", "name", "slug"],
      },
      {
        model: PortalCustomer,
        as: "portalCustomer",
        attributes: ["id", "email", "firstname", "lastname", "phone"],
      },
      {
        model: CustomerAccount,
        as: "customerAccount",
        attributes: ["id", "leadId", "status"],
      },
      {
        model: Brand,
        as: "brand",
        attributes: ["id", "name", "slug"],
      },
    ],
  });

  return {
    items: rows.map(serializePortalSubmission),
    total: count,
    page: safePage,
    limit: safeLimit,
    totalPages: Math.ceil(count / safeLimit) || 1,
  };
};

export const getPortalServiceSubmissionAdmin = async (id: number) => {
  const row = await PortalServiceSubmission.findByPk(id, {
    include: [
      {
        model: PortalService,
        as: "service",
      },
      {
        model: PortalCustomer,
        as: "portalCustomer",
        attributes: ["id", "email", "firstname", "lastname", "phone"],
      },
      {
        model: CustomerAccount,
        as: "customerAccount",
        attributes: ["id", "leadId", "status"],
      },
      {
        model: Brand,
        as: "brand",
        attributes: ["id", "name", "slug"],
      },
    ],
  });
  if (!row) throw new Error("Service submission not found");
  return serializePortalSubmission(row);
};

export const updatePortalServiceSubmissionAdmin = async (
  id: number,
  payload: { status?: string; adminNotes?: string }
) => {
  const row = await PortalServiceSubmission.findByPk(id);
  if (!row) throw new Error("Service submission not found");

  await row.update({
    ...(payload.status != null ? { status: payload.status as any } : {}),
    ...(payload.adminNotes !== undefined
      ? { adminNotes: payload.adminNotes?.trim() || null }
      : {}),
  });

  const reloaded = await row.reload({
    include: [
      {
        model: PortalService,
        as: "service",
        attributes: ["id", "name", "slug", "formFields"],
      },
      {
        model: PortalCustomer,
        as: "portalCustomer",
        attributes: ["id", "email", "firstname", "lastname", "phone"],
      },
      {
        model: CustomerAccount,
        as: "customerAccount",
        attributes: ["id", "leadId", "status"],
      },
      {
        model: Brand,
        as: "brand",
        attributes: ["id", "name", "slug"],
      },
    ],
  });

  return serializePortalSubmission(reloaded);
};
