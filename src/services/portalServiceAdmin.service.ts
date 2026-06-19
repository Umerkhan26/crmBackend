import { Op } from "sequelize";
import "../models/associations";
import Brand from "../models/brand.model";
import Lead from "../models/lead.model";
import ProductSale from "../models/product.model";
import PortalService from "../models/portalService.model";
import PortalServiceSubmission from "../models/portalServiceSubmission.model";
import CustomerAccount from "../models/customerAccount.model";
import PortalCustomer from "../models/portalCustomer.model";
import {
  normalizeFormData,
  normalizeFormFields,
  slugifyServiceName,
} from "../types/portalServiceForm";

const PORTAL_CUSTOMER_ATTRS = [
  "id",
  "email",
  "firstname",
  "lastname",
  "phone",
  "status",
  "last_login",
  "createdAt",
] as const;

const submissionDetailIncludes = [
  {
    model: PortalService,
    as: "service",
  },
  {
    model: PortalCustomer,
    as: "portalCustomer",
    attributes: [...PORTAL_CUSTOMER_ATTRS],
  },
  {
    model: CustomerAccount,
    as: "customerAccount",
    attributes: [
      "id",
      "leadId",
      "saleId",
      "status",
      "brandId",
      "portalCustomerId",
      "createdAt",
    ],
    include: [
      {
        model: PortalCustomer,
        as: "portalCustomer",
        attributes: [...PORTAL_CUSTOMER_ATTRS],
      },
      {
        model: Lead,
        as: "lead",
        required: false,
        attributes: ["id", "campaignName", "leadData"],
      },
      {
        model: ProductSale,
        as: "sale",
        required: false,
        attributes: ["id", "status", "conversionDate", "productType", "price"],
      },
    ],
  },
  {
    model: Brand,
    as: "brand",
    attributes: ["id", "name", "slug"],
  },
];

const parseLeadData = (raw: unknown): Record<string, unknown> => {
  if (!raw) return {};
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  if (typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return {};
};

const resolveCustomerContact = (json: Record<string, unknown>) => {
  const portalCustomer = json.portalCustomer as Record<string, unknown> | undefined;
  const account = json.customerAccount as Record<string, unknown> | undefined;
  const accountPortalCustomer = account?.portalCustomer as
    | Record<string, unknown>
    | undefined;
  const lead = account?.lead as Record<string, unknown> | undefined;
  const leadData = parseLeadData(lead?.leadData);

  const firstname =
    portalCustomer?.firstname ||
    accountPortalCustomer?.firstname ||
    leadData.first_name ||
    null;
  const lastname =
    portalCustomer?.lastname ||
    accountPortalCustomer?.lastname ||
    leadData.last_name ||
    null;
  const email =
    portalCustomer?.email ||
    accountPortalCustomer?.email ||
    leadData.email ||
    null;
  const phone =
    portalCustomer?.phone ||
    accountPortalCustomer?.phone ||
    leadData.phone_number ||
    null;

  const name = [firstname, lastname]
    .filter((v) => v && String(v).trim())
    .join(" ")
    .trim();

  return {
    name: name || null,
    firstname: firstname ? String(firstname) : null,
    lastname: lastname ? String(lastname) : null,
    email: email ? String(email) : null,
    phone: phone ? String(phone) : null,
    accountStatus: account?.status ? String(account.status) : null,
    memberSince:
      accountPortalCustomer?.createdAt ||
      portalCustomer?.createdAt ||
      account?.createdAt ||
      null,
    lastLogin:
      portalCustomer?.last_login || accountPortalCustomer?.last_login || null,
  };
};

const serializeSubmissionHistoryItem = (row: PortalServiceSubmission) => {
  const json = row.toJSON() as unknown as Record<string, unknown>;
  const service = json.service as Record<string, unknown> | undefined;
  return {
    id: json.id,
    status: json.status,
    submittedAt: json.submittedAt,
    serviceId: json.serviceId,
    serviceName: service?.name || null,
    serviceSlug: service?.slug || null,
  };
};

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

export const listPortalServicesAdmin = async ({
  brandId,
  page = 1,
  limit = 20,
}: {
  brandId?: number;
  page?: number;
  limit?: number;
} = {}) => {
  const safePage = Math.max(1, page);
  const safeLimit = Math.min(100, Math.max(5, limit));
  const offset = (safePage - 1) * safeLimit;

  const where: Record<string, unknown> = {};
  if (brandId) where.brandId = brandId;

  const { rows, count } = await PortalService.findAndCountAll({
    where,
    order: [
      ["sortOrder", "ASC"],
      ["id", "ASC"],
    ],
    limit: safeLimit,
    offset,
  });

  return {
    items: rows.map(serializePortalService),
    total: count,
    page: safePage,
    limit: safeLimit,
    totalPages: Math.ceil(count / safeLimit) || 1,
  };
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
    include: submissionDetailIncludes as any,
  });
  if (!row) throw new Error("Service submission not found");

  const serialized = serializePortalSubmission(row) as Record<string, unknown>;
  const customerContact = resolveCustomerContact(serialized);

  const historyWhere: Record<string, unknown> = {
    id: { [Op.ne]: row.id },
  };
  if (row.portalCustomerId) {
    historyWhere.portalCustomerId = row.portalCustomerId;
  } else if (row.customerAccountId) {
    historyWhere.customerAccountId = row.customerAccountId;
  } else {
    return {
      ...serialized,
      customerContact,
      relatedSubmissions: [],
    };
  }

  const historyRows = await PortalServiceSubmission.findAll({
    where: historyWhere,
    order: [["submittedAt", "DESC"]],
    limit: 15,
    include: [
      {
        model: PortalService,
        as: "service",
        attributes: ["id", "name", "slug"],
      },
    ],
  });

  return {
    ...serialized,
    customerContact,
    relatedSubmissions: historyRows.map(serializeSubmissionHistoryItem),
  };
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

  return getPortalServiceSubmissionAdmin(id);
};
