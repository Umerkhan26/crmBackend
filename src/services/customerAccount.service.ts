import { Op } from "sequelize";
import CustomerAccount from "../models/customerAccount.model";
import User from "../models/user.model";
import Brand from "../models/brand.model";
import Lead, { AssigneeWithStatus, LeadStatus } from "../models/lead.model";
import ProductSale from "../models/product.model";
import { getPagination, getPagingData } from "../utils/paginate";
import { provisionCustomerFromSale } from "./customerProvisioning.service";
import {
  assertCustomerAccountAccess,
  buildCustomerAccountSaleScopeWhere,
  resolveCustomerListScope,
} from "../utils/customerAccountScope";

const LEAD_STATUSES = [
  "pending",
  "to_call",
  "interested",
  "most_interested",
  "sold",
  "not_answered",
  "not_interested",
  "do_not_call",
  "hot_lead",
  "lead_rejected",
] as const;

const SALE_STATUSES = ["pending", "converted", "cancelled"] as const;

const parseJsonField = <T>(raw: unknown, fallback: T): T => {
  if (Array.isArray(raw)) return raw as T;
  if (raw && typeof raw === "object") return raw as T;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }
  return fallback;
};

const patchLinkedLead = async (
  lead: InstanceType<typeof Lead>,
  sale: InstanceType<typeof ProductSale> | null,
  opts: { leadStatus?: string; businessName?: string }
) => {
  const leadUpdates: { assignees?: AssigneeWithStatus[]; leadData?: Record<string, unknown> } =
    {};
  const assignees = parseJsonField<AssigneeWithStatus[]>(lead.assignees, []).map((a) => ({
    ...a,
  }));
  let leadData = parseJsonField<Record<string, unknown>>(lead.leadData, {});
  let assigneesChanged = false;

  if (opts.leadStatus) {
    const st = String(opts.leadStatus).toLowerCase().trim() as LeadStatus;
    if (!LEAD_STATUSES.includes(st as (typeof LEAD_STATUSES)[number])) {
      throw new Error(`Invalid lead status. Allowed: ${LEAD_STATUSES.join(", ")}`);
    }
    const assigneeId =
      sale?.assigneeId ??
      assignees[0]?.userId ??
      (assignees[0] as { user_id?: number; id?: number })?.user_id ??
      (assignees[0] as { id?: number })?.id;
    if (assignees.length && assigneeId != null) {
      let idx = assignees.findIndex(
        (a) =>
          Number(a.userId ?? (a as { user_id?: number }).user_id ?? (a as { id?: number }).id) ===
          Number(assigneeId)
      );
      if (idx < 0) idx = 0;
      const prev = assignees[idx];
      assignees[idx] = {
        ...prev,
        userId: Number(prev.userId ?? assigneeId),
        status: st,
        assignedAt: prev.assignedAt || new Date().toISOString(),
      };
      assigneesChanged = true;
    } else {
      leadData = { ...leadData, status: st };
    }
  }

  if (opts.businessName !== undefined) {
    leadData = { ...leadData, businessName: String(opts.businessName).trim() };
  }

  if (assigneesChanged) leadUpdates.assignees = assignees;
  if (
    opts.businessName !== undefined ||
    (opts.leadStatus && !assigneesChanged)
  ) {
    leadUpdates.leadData = leadData;
  }

  if (Object.keys(leadUpdates).length > 0) {
    const patch: { assignees?: AssigneeWithStatus[]; leadData?: Record<string, unknown> } =
      {};
    if (leadUpdates.assignees) patch.assignees = leadUpdates.assignees;
    if (leadUpdates.leadData) patch.leadData = leadUpdates.leadData;
    await lead.update(patch);
  }
};

export const listCustomerAccounts = async ({
  page = 1,
  limit = 10,
  search = "",
  brandId,
  viewerUserId,
  viewerPermissions = [],
}: {
  page?: number;
  limit?: number;
  search?: string;
  brandId?: number;
  viewerUserId?: number;
  viewerPermissions?: string[];
}) => {
  const { offset, limit: pageLimit } = getPagination({ page, limit });

  const userWhere: any = {};
  if (search.trim()) {
    userWhere[Op.or] = [
      { email: { [Op.like]: `%${search}%` } },
      { firstname: { [Op.like]: `%${search}%` } },
      { lastname: { [Op.like]: `%${search}%` } },
    ];
  }

  const where: any = {};
  if (brandId) where.brandId = brandId;

  let scopeLabel: "all" | "own" | "team" = "all";
  const saleInclude: any = {
    model: ProductSale,
    as: "sale",
    attributes: ["id", "status", "conversionDate", "assigneeId", "createdBy", "brandId"],
    required: false,
  };

  if (viewerUserId) {
    const scopeResult = await resolveCustomerListScope(
      viewerUserId,
      viewerPermissions,
    );
    scopeLabel = scopeResult.scope;
    const saleScope = buildCustomerAccountSaleScopeWhere(scopeResult);
    if (saleScope) {
      saleInclude.where = saleScope;
      saleInclude.required = true;
    }
  }

  const data = await CustomerAccount.findAndCountAll({
    where,
    offset,
    limit: pageLimit,
    order: [["createdAt", "DESC"]],
    distinct: true,
    include: [
      {
        model: User,
        as: "user",
        attributes: ["id", "firstname", "lastname", "email", "phone", "status"],
        where: Object.keys(userWhere).length ? userWhere : undefined,
        required: !!search.trim(),
      },
      {
        model: Brand,
        as: "brand",
        attributes: ["id", "name", "slug"],
        required: false,
      },
      {
        model: Lead,
        as: "lead",
        attributes: ["id", "campaignName"],
        required: false,
      },
      saleInclude,
    ],
  });

  const paging = getPagingData(data, page, pageLimit);
  return { ...paging, scope: scopeLabel };
};

export const getCustomerAccountById = async (
  id: number,
  viewerUserId?: number,
  viewerPermissions: string[] = [],
) => {
  const account = await CustomerAccount.findByPk(id, {
    include: [
      {
        model: User,
        as: "user",
        attributes: ["id", "firstname", "lastname", "email", "phone", "status", "userrole"],
      },
      {
        model: Brand,
        as: "brand",
        required: false,
        attributes: ["id", "name", "slug", "salesFormConfig"],
      },
      { model: Lead, as: "lead", required: false },
      {
        model: ProductSale,
        as: "sale",
        required: false,
        attributes: ["id", "status", "conversionDate", "assigneeId", "createdBy", "brandId"],
      },
    ],
  });
  if (!account) throw new Error("Customer account not found");

  if (viewerUserId) {
    const plain = account.get({ plain: true }) as any;
    await assertCustomerAccountAccess(plain, viewerUserId, viewerPermissions);
  }

  return account;
};

export const updateCustomerAccount = async (
  id: number,
  payload: {
    status?: "active" | "suspended";
    firstname?: string;
    lastname?: string;
    email?: string;
    phone?: string;
    brandId?: number | null;
    leadStatus?: string;
    businessName?: string;
    saleStatus?: string;
    saleNotes?: string;
    productType?: string;
    salePrice?: number | string | null;
    products?: Array<{
      productType?: string;
      productName?: string;
      price?: number | string;
      notes?: string;
    }>;
  }
) => {
  const account = await CustomerAccount.findByPk(id, {
    include: [
      { model: User, as: "user", required: true },
      { model: Lead, as: "lead", required: false },
      { model: ProductSale, as: "sale", required: false },
    ],
  });
  if (!account) throw new Error("Customer account not found");

  if (payload.status === "active" || payload.status === "suspended") {
    await account.update({ status: payload.status });
  }

  if (payload.brandId !== undefined) {
    const brandId = payload.brandId === null ? null : Number(payload.brandId);
    if (brandId != null) {
      const brand = await Brand.findByPk(brandId);
      if (!brand) throw new Error("Brand not found");
    }
    await account.update({ brandId });
  }

  const user = (account as any).user as InstanceType<typeof User>;
  if (user) {
    const userUpdates: Record<string, string> = {};
    if (payload.firstname !== undefined) userUpdates.firstname = String(payload.firstname).trim();
    if (payload.lastname !== undefined) userUpdates.lastname = String(payload.lastname).trim();
    if (payload.phone !== undefined) userUpdates.phone = String(payload.phone).trim();

    if (payload.email !== undefined) {
      const email = String(payload.email).trim().toLowerCase();
      if (!email) throw new Error("Email is required");
      const existing = await User.findOne({ where: { email } });
      if (existing && existing.id !== user.id) {
        throw new Error("Email already in use by another user");
      }
      userUpdates.email = email;
    }

    if (Object.keys(userUpdates).length > 0) {
      await user.update(userUpdates);
    }
  }

  const lead = (account as { lead?: InstanceType<typeof Lead> }).lead ?? null;
  const sale = (account as { sale?: InstanceType<typeof ProductSale> }).sale ?? null;

  if (lead && (payload.leadStatus !== undefined || payload.businessName !== undefined)) {
    await patchLinkedLead(lead, sale, {
      leadStatus: payload.leadStatus,
      businessName: payload.businessName,
    });
  }

  if (sale && account.saleId) {
    const saleUpdates: Record<string, unknown> = {};
    if (payload.saleStatus !== undefined) {
      const st = String(payload.saleStatus).toLowerCase().trim();
      if (!SALE_STATUSES.includes(st as (typeof SALE_STATUSES)[number])) {
        throw new Error(`Invalid sale status. Allowed: ${SALE_STATUSES.join(", ")}`);
      }
      saleUpdates.status = st;
    }
    if (payload.saleNotes !== undefined) {
      saleUpdates.notes = String(payload.saleNotes).trim();
    }

    if (payload.products !== undefined) {
      const lines = (payload.products || [])
        .map((p) => ({
          productType: String(p.productType || p.productName || "").trim(),
          price: Number(p.price) || 0,
          notes: String(p.notes || "").trim(),
        }))
        .filter((p) => p.productType);
      if (lines.length === 0) {
        throw new Error("Add at least one product with a name");
      }
      saleUpdates.products = lines;
      saleUpdates.productType = lines[0].productType;
      saleUpdates.price = lines.reduce((sum, line) => sum + (Number(line.price) || 0), 0);
    } else {
      if (payload.productType !== undefined) {
        saleUpdates.productType = String(payload.productType).trim();
      }
      if (payload.salePrice !== undefined && payload.salePrice !== "") {
        const price = Number(payload.salePrice);
        if (Number.isNaN(price)) throw new Error("Invalid sale price");
        saleUpdates.price = price;
      } else if (payload.salePrice === "" || payload.salePrice === null) {
        saleUpdates.price = null;
      }
    }

    if (Object.keys(saleUpdates).length > 0) {
      await sale.update(saleUpdates);
    }
  }

  const refreshed = await getCustomerAccountById(id);
  return refreshed.get({ plain: true });
};

export const deleteCustomerAccount = async (id: number) => {
  const account = await CustomerAccount.findByPk(id);
  if (!account) throw new Error("Customer account not found");

  const saleId = account.saleId;
  await account.destroy();

  if (saleId) {
    await ProductSale.update(
      { customerProvisionedAt: null },
      { where: { id: saleId } }
    );
  }

  return { deleted: true, id };
};

export const provisionFromSaleId = async (
  saleId: number,
  agentUserId: number,
  brandId?: number
) => {
  const sale = await ProductSale.findByPk(saleId);
  if (!sale?.leadId) throw new Error("Sale or linked lead not found");

  return provisionCustomerFromSale({
    saleId,
    leadId: sale.leadId,
    brandId: brandId ?? sale.brandId ?? null,
    agentUserId,
  });
};
