import { Op, literal, Transaction } from "sequelize";
import db from "../../db";
import CustomerAccount from "../models/customerAccount.model";
import PortalCustomer from "../models/portalCustomer.model";
import Brand from "../models/brand.model";
import Lead, { AssigneeWithStatus, LeadStatus } from "../models/lead.model";
import ProductSale from "../models/product.model";
import PortalPopupDismissal from "../models/portalPopupDismissal.model";
import FollowUpEnrollment from "../models/followUpEnrollment.model";
import FollowUpScheduledEmail from "../models/followUpScheduledEmail.model";
import { getPagination, getPagingData } from "../utils/paginate";
import {
  provisionCustomerFromSale,
  resendCustomerCredentials,
} from "./customerProvisioning.service";
import {
  assertCustomerAccountAccess,
  buildCustomerAccountSaleScopeWhere,
  resolveCustomerListScope,
} from "../utils/customerAccountScope";
import { attachPortalCustomerAsUser, mapPortalCustomerAsUser } from "../utils/portalCustomerResponse";

const SALE_SUMMARY_ATTRIBUTES = [
  "id",
  "status",
  "conversionDate",
  "assigneeId",
  "createdBy",
  "brandId",
] as const;

const SALE_DETAIL_ATTRIBUTES = [
  ...SALE_SUMMARY_ATTRIBUTES,
  "productType",
  "price",
  "notes",
  "products",
] as const;

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
  opts: { leadStatus?: string; businessName?: string },
  transaction?: Transaction
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
    await lead.update(patch, transaction ? { transaction } : undefined);
  }
};

export type CustomerListEmailFilter = "never" | "opened";

const parseCustomerSearchTerm = (raw: string) => {
  const term = raw.trim();
  const leadHyphen = term.match(/^([A-Za-z]+)-(\d+)$/);
  const leadLegacy = term.match(/^([A-Za-z]+)(\d+)$/);
  const saleExplicit = term.match(/^sale\s*#?\s*(\d+)$/i);
  const numeric = /^\d+$/.test(term) ? parseInt(term, 10) : null;
  const leadIdFromCode = leadHyphen
    ? parseInt(leadHyphen[2], 10)
    : leadLegacy
      ? parseInt(leadLegacy[2], 10)
      : null;

  return {
    term,
    leadIdFromCode: Number.isFinite(leadIdFromCode) ? leadIdFromCode : null,
    saleId: saleExplicit ? parseInt(saleExplicit[1], 10) : null,
    numeric: Number.isFinite(numeric) ? numeric : null,
  };
};

const buildCustomerAccountSearchClause = async (raw: string) => {
  const parsed = parseCustomerSearchTerm(raw);
  if (!parsed.term) return null;

  const orConditions: Record<string, unknown>[] = [];

  const matchingCustomers = await PortalCustomer.findAll({
    where: {
      [Op.or]: [
        { email: { [Op.like]: `%${parsed.term}%` } },
        { firstname: { [Op.like]: `%${parsed.term}%` } },
        { lastname: { [Op.like]: `%${parsed.term}%` } },
        { phone: { [Op.like]: `%${parsed.term}%` } },
      ],
    },
    attributes: ["id"],
  });
  if (matchingCustomers.length) {
    orConditions.push({
      portalCustomerId: { [Op.in]: matchingCustomers.map((u) => u.id) },
    });
  }

  if (parsed.leadIdFromCode != null) {
    orConditions.push({ leadId: parsed.leadIdFromCode });
  }
  if (parsed.saleId != null) {
    orConditions.push({ saleId: parsed.saleId });
  }
  if (parsed.numeric != null) {
    orConditions.push({ id: parsed.numeric });
    if (parsed.leadIdFromCode == null) {
      orConditions.push({ leadId: parsed.numeric });
    }
    if (parsed.saleId == null) {
      orConditions.push({ saleId: parsed.numeric });
    }
  }

  if (!orConditions.length) {
    return { id: -1 };
  }
  return { [Op.or]: orConditions };
};

export const listCustomerAccounts = async ({
  page = 1,
  limit = 10,
  search = "",
  brandId,
  status,
  hasOrder,
  emailFilter,
  memberSinceFrom,
  memberSinceTo,
  viewerUserId,
  viewerPermissions = [],
}: {
  page?: number;
  limit?: number;
  search?: string;
  brandId?: number;
  status?: "active" | "suspended";
  hasOrder?: "yes" | "no";
  emailFilter?: CustomerListEmailFilter;
  memberSinceFrom?: string;
  memberSinceTo?: string;
  viewerUserId?: number;
  viewerPermissions?: string[];
}) => {
  const { offset, limit: pageLimit } = getPagination({ page, limit });

  const filterAnd: unknown[] = [];

  if (brandId) filterAnd.push({ brandId });
  if (status === "active" || status === "suspended") {
    filterAnd.push({ status });
  }
  if (hasOrder === "yes") {
    filterAnd.push({ saleId: { [Op.ne]: null } });
  } else if (hasOrder === "no") {
    filterAnd.push({ saleId: null });
  }
  if (memberSinceFrom || memberSinceTo) {
    const createdAt: Record<string | symbol, Date> = {};
    if (memberSinceFrom) {
      const from = new Date(memberSinceFrom);
      if (!Number.isNaN(from.getTime())) {
        createdAt[Op.gte] = from;
      }
    }
    if (memberSinceTo) {
      const to = new Date(memberSinceTo);
      if (!Number.isNaN(to.getTime())) {
        to.setHours(23, 59, 59, 999);
        createdAt[Op.lte] = to;
      }
    }
    if (Object.keys(createdAt).length) {
      filterAnd.push({ createdAt });
    }
  }

  if (search.trim()) {
    const searchClause = await buildCustomerAccountSearchClause(search);
    if (searchClause) filterAnd.push(searchClause);
  }

  if (emailFilter === "never") {
    filterAnd.push(
      literal(`NOT EXISTS (
        SELECT 1 FROM portal_customers pc
        INNER JOIN email_logs el ON (
          el.\`to\` = pc.email OR el.\`to\` LIKE CONCAT('%', pc.email, '%')
        )
        WHERE pc.id = \`CustomerAccount\`.\`portalCustomerId\`
      )`)
    );
  } else if (emailFilter === "opened") {
    filterAnd.push(
      literal(`EXISTS (
        SELECT 1 FROM portal_customers pc
        INNER JOIN email_logs el ON (
          el.customerAccountId = \`CustomerAccount\`.\`id\`
          OR el.\`to\` = pc.email
          OR el.\`to\` LIKE CONCAT('%', pc.email, '%')
        )
        WHERE pc.id = \`CustomerAccount\`.\`portalCustomerId\`
          AND (
            el.openedAt IS NOT NULL
            OR LOWER(COALESCE(el.status, '')) REGEXP 'open|read|viewed'
          )
      )`)
    );
  }

  const where: any = filterAnd.length ? { [Op.and]: filterAnd } : {};

  let scopeLabel: "all" | "own" | "team" = "all";
  const saleInclude: any = {
    model: ProductSale,
    as: "sale",
    attributes: [...SALE_SUMMARY_ATTRIBUTES],
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
        model: PortalCustomer,
        as: "portalCustomer",
        attributes: ["id", "firstname", "lastname", "email", "phone", "status"],
        required: false,
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
  return {
    ...paging,
    scope: scopeLabel,
    data: mapPortalCustomerAsUser(
      paging.data.map((row) => row.get({ plain: true }) as Record<string, unknown>)
    ),
  };
};

export const getCustomerAccountById = async (
  id: number,
  viewerUserId?: number,
  viewerPermissions: string[] = [],
) => {
  const account = await CustomerAccount.findByPk(id, {
    include: [
      {
        model: PortalCustomer,
        as: "portalCustomer",
        attributes: ["id", "firstname", "lastname", "email", "phone", "status"],
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
        attributes: [...SALE_DETAIL_ATTRIBUTES],
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
      { model: PortalCustomer, as: "portalCustomer", required: true },
      { model: Lead, as: "lead", required: false },
      { model: ProductSale, as: "sale", required: false },
    ],
  });
  if (!account) throw new Error("Customer account not found");

  const portalCustomer = (account as any).portalCustomer as InstanceType<
    typeof PortalCustomer
  >;
  const lead = (account as { lead?: InstanceType<typeof Lead> }).lead ?? null;
  const sale = (account as { sale?: InstanceType<typeof ProductSale> }).sale ?? null;

  if (payload.brandId !== undefined && payload.brandId !== null) {
    const brand = await Brand.findByPk(Number(payload.brandId));
    if (!brand) throw new Error("Brand not found");
  }

  if (payload.email !== undefined) {
    const email = String(payload.email).trim().toLowerCase();
    if (!email) throw new Error("Email is required");
    const existing = await PortalCustomer.findOne({ where: { email } });
    if (existing && existing.id !== portalCustomer.id) {
      throw new Error("Email already in use by another customer");
    }
  }

  let normalizedProductLines:
    | Array<{ productType: string; price: number; notes: string }>
    | undefined;

  if (payload.products !== undefined) {
    const lines = (payload.products || [])
      .map((p) => ({
        productType: String(p.productType || p.productName || "").trim(),
        price: Number(p.price) || 0,
        notes: String(p.notes || "").trim(),
      }))
      .filter((p) => p.productType);

    if (lines.length > 0) {
      const productKeys = lines.map((p) => p.productType.toLowerCase());
      if (new Set(productKeys).size !== productKeys.length) {
        throw new Error(
          "Duplicate products are not allowed on the same sale. Update the existing line instead."
        );
      }
      normalizedProductLines = lines;
    }
  }

  if (payload.saleStatus !== undefined) {
    const st = String(payload.saleStatus).toLowerCase().trim();
    if (!SALE_STATUSES.includes(st as (typeof SALE_STATUSES)[number])) {
      throw new Error(`Invalid sale status. Allowed: ${SALE_STATUSES.join(", ")}`);
    }
  }

  await db.transaction(async (transaction) => {
    if (payload.status === "active" || payload.status === "suspended") {
      await account.update({ status: payload.status }, { transaction });
    }

    if (payload.brandId !== undefined) {
      const brandId = payload.brandId === null ? null : Number(payload.brandId);
      await account.update({ brandId }, { transaction });
      if (sale) {
        await sale.update({ brandId }, { transaction });
      }
      if (portalCustomer) {
        await portalCustomer.update({ brandId }, { transaction });
      }
    }

    if (portalCustomer) {
      const customerUpdates: Record<string, string> = {};
      if (payload.firstname !== undefined) {
        customerUpdates.firstname = String(payload.firstname).trim();
      }
      if (payload.lastname !== undefined) {
        customerUpdates.lastname = String(payload.lastname).trim();
      }
      if (payload.phone !== undefined) {
        customerUpdates.phone = String(payload.phone).trim();
      }
      if (payload.email !== undefined) {
        customerUpdates.email = String(payload.email).trim().toLowerCase();
      }

      if (Object.keys(customerUpdates).length > 0) {
        await portalCustomer.update(customerUpdates, { transaction });
      }
    }

    if (lead && (payload.leadStatus !== undefined || payload.businessName !== undefined)) {
      await patchLinkedLead(
        lead,
        sale,
        {
          leadStatus: payload.leadStatus,
          businessName: payload.businessName,
        },
        transaction
      );
    }

    if (sale && account.saleId) {
      const saleUpdates: Record<string, unknown> = {};
      if (payload.saleStatus !== undefined) {
        saleUpdates.status = String(payload.saleStatus).toLowerCase().trim();
      }
      if (payload.saleNotes !== undefined) {
        saleUpdates.notes = String(payload.saleNotes).trim();
      }

      if (normalizedProductLines) {
        saleUpdates.products = normalizedProductLines;
        saleUpdates.productType = normalizedProductLines[0].productType;
        saleUpdates.price = normalizedProductLines.reduce(
          (sum, line) => sum + (Number(line.price) || 0),
          0
        );
      } else if (payload.products === undefined) {
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
        await sale.update(saleUpdates, { transaction });
      }
    }
  });

  const refreshed = await getCustomerAccountById(id);
  return attachPortalCustomerAsUser(
    refreshed.get({ plain: true }) as unknown as Record<string, unknown>
  );
};

export const deleteCustomerAccount = async (id: number) => {
  const account = await CustomerAccount.findByPk(id);
  if (!account) throw new Error("Customer account not found");

  const portalCustomerId = account.portalCustomerId;
  const saleId = account.saleId;

  let portalCustomerDeleted = false;

  await db.transaction(async (transaction) => {
    const enrollments = await FollowUpEnrollment.findAll({
      where: { customerAccountId: id },
      attributes: ["id"],
      transaction,
    });
    const enrollmentIds = enrollments.map((row) => row.id);
    if (enrollmentIds.length) {
      await FollowUpScheduledEmail.destroy({
        where: { enrollmentId: { [Op.in]: enrollmentIds } },
        transaction,
      });
      await FollowUpEnrollment.destroy({
        where: { id: { [Op.in]: enrollmentIds } },
        transaction,
      });
    }

    await account.destroy({ transaction });

    if (saleId) {
      await ProductSale.update(
        { customerProvisionedAt: null },
        { where: { id: saleId }, transaction }
      );
    }

    const remainingAccounts = await CustomerAccount.count({
      where: { portalCustomerId },
      transaction,
    });

    if (remainingAccounts > 0) return;

    try {
      await PortalPopupDismissal.destroy({
        where: { portalCustomerId },
        transaction,
      });
    } catch (err) {
      const msg = String((err as Error)?.message || err);
      if (!/Unknown column.*portalCustomerId/i.test(msg)) {
        throw err;
      }
    }

    const portalCustomer = await PortalCustomer.findByPk(portalCustomerId, {
      transaction,
    });
    if (!portalCustomer) return;

    await portalCustomer.destroy({ transaction });
    portalCustomerDeleted = true;
  });

  return {
    deleted: true,
    id,
    portalCustomerId,
    portalCustomerDeleted,
  };
};

export const provisionFromSaleId = async (
  saleId: number,
  agentUserId: number,
  brandId?: number,
  options: { resend?: boolean } = {},
) => {
  const sale = await ProductSale.findByPk(saleId);
  if (!sale?.leadId) throw new Error("Sale or linked lead not found");

  const lead = await Lead.findByPk(sale.leadId);
  const account = await CustomerAccount.findOne({ where: { saleId } });
  const resolvedBrandId =
    brandId ?? account?.brandId ?? sale.brandId ?? lead?.brandId ?? null;

  if (options.resend) {
    return resendCustomerCredentials({
      saleId,
      leadId: sale.leadId,
      brandId: resolvedBrandId,
      agentUserId,
    });
  }

  return provisionCustomerFromSale({
    saleId,
    leadId: sale.leadId,
    brandId: resolvedBrandId,
    agentUserId,
  });
};
