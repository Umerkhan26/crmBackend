import { Op } from "sequelize";
import jwt from "jsonwebtoken";
import Brand from "../models/brand.model";
import CustomerAccount from "../models/customerAccount.model";
import CustomerEngagement from "../models/customerEngagement.model";
import PortalAnnouncement from "../models/portalAnnouncement.model";
import PortalPopup from "../models/portalPopup.model";
import PortalPopupDismissal from "../models/portalPopupDismissal.model";
import ProductSale from "../models/product.model";
import Lead, { AssigneeWithStatus } from "../models/lead.model";
import PortalCustomer from "../models/portalCustomer.model";
import Role from "../models/role.model";
import { User } from "../models/user.model";
import { resolvePortalBrand, normalizePortalBaseUrl } from "../utils/portalHost";
import { getBrandManagerIdsForUser } from "../utils/brandUtils";
import {
  logPortalActivityFromContext,
  portalActivityLabel,
} from "./portalActivity.service";
import { sendNotification } from "./notification.service";
import type { PortalActivityAction } from "../models/portalActivityEvent.model";
import { getCustomerEmailBrandThemeFromBrand } from "../utils/customerEmailBrandTheme";

const parseEngagementMetadata = (raw: unknown): Record<string, unknown> => {
  if (!raw) return {};
  if (typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return typeof parsed === "object" && parsed && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }
  return {};
};

const parseLeadAssignees = (raw: unknown): AssigneeWithStatus[] => {
  if (Array.isArray(raw)) return raw as AssigneeWithStatus[];
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as AssigneeWithStatus[]) : [];
    } catch {
      return [];
    }
  }
  return [];
};

const ADMIN_ROLE_NAMES = new Set(["admin", "adminn"]);

const getAdminUserIds = async (): Promise<number[]> => {
  const roles = await Role.findAll({
    where: { name: { [Op.in]: [...ADMIN_ROLE_NAMES] } },
    attributes: ["id"],
  });
  const roleIds = roles.map((r) => r.id);
  if (!roleIds.length) return [];

  const users = await User.findAll({
    where: { roleId: { [Op.in]: roleIds } },
    attributes: ["id"],
  });
  return users.map((u) => Number(u.id)).filter((id) => id > 0);
};

/** Assigned agents + their brand managers + all admins. */
const resolveOfferClaimNotifyUserIds = async (input: {
  saleId?: number | null;
  leadId?: number | null;
  createdBy?: number | null;
}): Promise<number[]> => {
  const agentIds = new Set<number>();
  let leadId = input.leadId ?? null;

  if (input.saleId) {
    const sale = await ProductSale.findByPk(input.saleId, {
      attributes: ["assigneeId", "leadId"],
    });
    if (sale?.assigneeId) agentIds.add(Number(sale.assigneeId));
    if (!leadId && sale?.leadId) leadId = sale.leadId;
  }

  if (leadId) {
    const lead = await Lead.findByPk(leadId, { attributes: ["assignees"] });
    for (const row of parseLeadAssignees(lead?.assignees)) {
      const uid = Number(row?.userId);
      if (Number.isFinite(uid) && uid > 0) agentIds.add(uid);
    }
  }

  if (!agentIds.size && input.createdBy) {
    agentIds.add(Number(input.createdBy));
  }

  const recipients = new Set<number>(agentIds);

  for (const agentId of agentIds) {
    const managerIds = await getBrandManagerIdsForUser(agentId);
    for (const managerId of managerIds) recipients.add(managerId);
  }

  for (const adminId of await getAdminUserIds()) {
    recipients.add(adminId);
  }

  return [...recipients];
};

const notifyAgentsOnOfferClaim = async (input: {
  portalCustomerId: number;
  engagement: CustomerEngagement;
  account: CustomerAccount;
}) => {
  const { portalCustomerId, engagement, account } = input;
  const saleId =
    engagement.saleId ??
    (parseEngagementMetadata(engagement.metadata).saleId as number | undefined) ??
    account.saleId ??
    null;

  const userIds = await resolveOfferClaimNotifyUserIds({
    saleId,
    leadId: account.leadId ?? null,
    createdBy: engagement.createdBy,
  });
  if (!userIds.length) return;

  const customer = await PortalCustomer.findByPk(portalCustomerId, {
    attributes: ["firstname", "lastname", "email"],
  });
  const customerName =
    [customer?.firstname, customer?.lastname].filter(Boolean).join(" ") ||
    customer?.email ||
    "A customer";

  const offerLabel = engagement.type === "discount" ? "discount" : "upsell offer";
  const orderPart = saleId ? ` on order #${saleId}` : "";
  const message = `${customerName} claimed your ${offerLabel}: "${engagement.title}"${orderPart}`;

  await Promise.all(
    userIds.map((userId) =>
      sendNotification(userId, message, customerName, {
        type: "offer_claim",
        engagementId: engagement.id,
        saleId,
        customerAccountId: account.id,
        portalCustomerId,
      })
    )
  );
};

const activeWindowWhere = () => {
  const now = new Date();
  return {
    status: "active",
    [Op.and]: [
      {
        [Op.or]: [{ startsAt: null }, { startsAt: { [Op.lte]: now } }],
      },
      {
        [Op.or]: [{ endsAt: null }, { endsAt: { [Op.gte]: now } }],
      },
    ],
  };
};

export const getBrandConfigForPortal = async (brand: Brand) => {
  const emailTheme = getCustomerEmailBrandThemeFromBrand(brand);
  const salesFormConfig = (brand.salesFormConfig || {}) as Record<string, unknown>;
  const portalTheme =
    (salesFormConfig.portalTheme as Record<string, unknown>) ||
    (salesFormConfig.theme as Record<string, unknown>) ||
    {};

  const billingEmail =
    (portalTheme.billingEmail as string) ||
    emailTheme.supportEmail ||
    (portalTheme.supportEmail as string) ||
    null;

  return {
    id: brand.id,
    name: brand.name,
    slug: brand.slug,
    subdomain: brand.subdomain,
    customerPortalUrl: normalizePortalBaseUrl(brand.customerPortalUrl),
    portalTheme: {
      logoUrl: emailTheme.logoUrl,
      faviconUrl: emailTheme.iconUrl,
      brandLabel: emailTheme.brandLabel,
      brandName: emailTheme.brandName,
      primaryColor: emailTheme.primaryColor || (portalTheme.primaryColor as string) || "#2563eb",
      accentColor: emailTheme.accentColor || (portalTheme.accentColor as string) || "#2563eb",
      supportEmail: emailTheme.supportEmail || (portalTheme.supportEmail as string) || null,
      supportPhone: (portalTheme.supportPhone as string) || null,
      billingEmail,
      invoiceCompanyName: emailTheme.brandLabel,
      invoiceWebsite:
        (portalTheme.invoiceWebsite as string) ||
        (portalTheme.website as string) ||
        (brand.subdomain ? `www.${brand.subdomain}.com` : null),
      services: Array.isArray(portalTheme.services)
        ? portalTheme.services
        : Array.isArray(salesFormConfig.services)
          ? salesFormConfig.services
          : [],
      ...portalTheme,
      tawkPropertyId: portalTheme.tawkPropertyId ?? null,
      tawkWidgetId: portalTheme.tawkWidgetId ?? null,
      tawkEnabled: portalTheme.tawkEnabled !== false,
    },
    localDev: {
      hint: "On localhost pass ?brandSlug=emrills or header x-customer-host: customer.emrills.com",
      envBrandSlug: process.env.CUSTOMER_PORTAL_LOCAL_BRAND_SLUG || null,
    },
  };
};

export const resolveBrandForPortalRequest = async (input: {
  host?: string;
  brandId?: number;
  brandSlug?: string;
}) => {
  const brand = await resolvePortalBrand(input);
  if (!brand) return null;
  return getBrandConfigForPortal(brand);
};

const requireAccountForBrand = async (portalCustomerId: number, brandId: number) => {
  const account = await CustomerAccount.findOne({
    where: { portalCustomerId, brandId, status: "active" },
  });
  if (!account) throw new Error("No customer account for this brand");
  return account;
};

export const getPortalContext = async (portalCustomerId: number, brandId: number) => {
  const account = await requireAccountForBrand(portalCustomerId, brandId);
  const brand = await Brand.findByPk(brandId);
  if (!brand) throw new Error("Brand not found");
  return { account, brand };
};

export const listCustomerOrders = async (
  portalCustomerId: number,
  brandId: number,
  _opts?: { skipActivityLog?: boolean }
) => {
  await getPortalContext(portalCustomerId, brandId);
  const accountFilter: any = { portalCustomerId, status: "active" };
  if (brandId) accountFilter.brandId = brandId;

  const accounts = await CustomerAccount.findAll({
    where: accountFilter,
    attributes: ["id", "brandId", "leadId", "saleId"],
  });

  const saleIds = accounts.map((a) => a.saleId).filter(Boolean) as number[];
  if (!saleIds.length) return { orders: [], accounts };

  const sales = await ProductSale.findAll({
    where: { id: { [Op.in]: saleIds } },
    order: [["conversionDate", "DESC"]],
  });

  const leadIds = sales.map((s) => s.leadId).filter(Boolean) as number[];
  const leads = leadIds.length
    ? await Lead.findAll({
        where: { id: { [Op.in]: leadIds } },
        attributes: ["id", "campaignName", "leadData"],
      })
    : [];
  const leadById = new Map(leads.map((l) => [l.id, l]));

  const parseLeadDataField = (raw: unknown): Record<string, unknown> | null => {
    if (raw == null) return null;
    if (typeof raw === "object" && !Array.isArray(raw)) {
      return raw as Record<string, unknown>;
    }
    if (typeof raw === "string") {
      try {
        const parsed = JSON.parse(raw);
        return typeof parsed === "object" && parsed && !Array.isArray(parsed)
          ? (parsed as Record<string, unknown>)
          : null;
      } catch {
        return null;
      }
    }
    return null;
  };

  const orders = sales.map((sale) => {
    const lead = sale.leadId ? leadById.get(sale.leadId) : null;
    const progress = parsePortalProgress((sale as any).portalProgress);
    return {
      id: sale.id,
      saleId: sale.id,
      leadId: sale.leadId,
      productType: sale.productType,
      price: sale.price,
      status: sale.status,
      conversionDate: sale.conversionDate,
      products: sale.products,
      brandId: sale.brandId,
      campaignName: lead?.campaignName ?? null,
      leadData: parseLeadDataField(lead?.leadData),
      progress,
    };
  });

  return { orders, accounts };
};

export type PortalProgressView = {
  steps: unknown[];
  percent: number;
  label: string;
};

export const parsePortalProgress = (raw: unknown): PortalProgressView => {
  if (raw == null) return { steps: [], percent: 0, label: "Pending" };
  if (typeof raw === "string") {
    try {
      return parsePortalProgress(JSON.parse(raw));
    } catch {
      return { steps: [], percent: 0, label: "Pending" };
    }
  }
  if (typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    const steps = Array.isArray(o.steps) ? o.steps : [];
    const percent = Number(o.percent) || 0;
    const label = String(o.label || "In progress");
    return { steps, percent, label };
  }
  return { steps: [], percent: 0, label: "Pending" };
};

export const getOrderProgress = async (
  portalCustomerId: number,
  brandId: number,
  saleId: number
) => {
  const { account } = await getPortalContext(portalCustomerId, brandId);
  const sale = await ProductSale.findByPk(saleId);
  if (!sale) throw new Error("Order not found");

  const linkedAccount = await CustomerAccount.findOne({
    where: { portalCustomerId, saleId, status: "active" },
  });
  if (!linkedAccount) throw new Error("Order not linked to your account");

  return {
    saleId: sale.id,
    progress: parsePortalProgress((sale as any).portalProgress),
    status: sale.status,
    productType: sale.productType,
  };
};

const sumOrderLineTotal = (order: {
  products?: unknown;
  price?: number | null;
}) => {
  let products: unknown[] = [];
  if (Array.isArray(order.products)) products = order.products;
  else if (typeof order.products === "string") {
    try {
      const parsed = JSON.parse(order.products);
      if (Array.isArray(parsed)) products = parsed;
    } catch {
      /* ignore */
    }
  }
  if (products.length) {
    const sum = products.reduce((total: number, p: any) => {
      const price = parseFloat(String(p?.price ?? p?.amount ?? 0)) || 0;
      return total + price;
    }, 0);
    if (sum > 0) return sum;
  }
  return parseFloat(String(order.price ?? 0)) || 0;
};

export const listCustomerInvoices = async (portalCustomerId: number, brandId: number) => {
  await getPortalContext(portalCustomerId, brandId);
  const { orders } = await listCustomerOrders(portalCustomerId, brandId);
  return {
    invoices: orders.map((o) => ({
      id: `INV-${o.saleId}`,
      saleId: o.saleId,
      amount: sumOrderLineTotal(o),
      currency: "USD",
      status: o.status === "converted" ? "paid" : o.status,
      issuedAt: o.conversionDate || null,
      description: o.productType,
      products: o.products,
    })),
  };
};

export const listCustomerOffers = async (
  portalCustomerId: number,
  brandId: number,
  _opts?: { skipActivityLog?: boolean }
) => {
  await getPortalContext(portalCustomerId, brandId);

  const accounts = await CustomerAccount.findAll({
    where: { portalCustomerId, brandId, status: "active" },
    attributes: ["id", "saleId"],
  });
  const accountIds = accounts.map((a) => a.id);
  if (!accountIds.length) return [];

  const accountSaleById = new Map(
    accounts.map((a) => [a.id, a.saleId ?? null])
  );

  const rows = await CustomerEngagement.findAll({
    where: {
      customerAccountId: { [Op.in]: accountIds },
      type: { [Op.in]: ["upsell", "discount"] },
      status: { [Op.in]: ["active", "sent", "applied"] },
    },
    order: [["createdAt", "DESC"]],
    limit: 50,
  });

  const saleIds = [
    ...new Set(
      rows
        .map((r) => r.saleId ?? accountSaleById.get(r.customerAccountId) ?? null)
        .filter((id): id is number => id != null)
    ),
  ];

  const sales = saleIds.length
    ? await ProductSale.findAll({
        where: { id: { [Op.in]: saleIds } },
        attributes: ["id", "productType", "price", "status"],
      })
    : [];
  const saleById = new Map(sales.map((s) => [s.id, s]));

  return rows.map((r) => {
    const meta = (r.metadata || {}) as Record<string, unknown>;
    const saleId =
      r.saleId ??
      (meta.saleId as number | undefined) ??
      accountSaleById.get(r.customerAccountId) ??
      null;
    const sale = saleId ? saleById.get(saleId) : null;
    const discountPercent =
      meta.discountPercent != null ? Number(meta.discountPercent) : null;
    const saleOrderPrice =
      sale?.price != null ? Number(sale.price) : null;
    const originalPrice =
      meta.originalPrice != null
        ? Number(meta.originalPrice)
        : saleOrderPrice;
    let discountedPrice: number | null =
      meta.discountedPrice != null ? Number(meta.discountedPrice) : null;
    let discountAmount: number | null =
      meta.discountAmount != null ? Number(meta.discountAmount) : null;
    if (
      discountedPrice == null &&
      originalPrice != null &&
      discountPercent != null &&
      !Number.isNaN(discountPercent) &&
      discountPercent > 0
    ) {
      discountAmount =
        Math.round(originalPrice * (discountPercent / 100) * 100) / 100;
      discountedPrice =
        Math.round((originalPrice - discountAmount) * 100) / 100;
    }
    const offerPrice = meta.price != null ? Number(meta.price) : null;
    const orderPrice =
      meta.orderPrice != null ? Number(meta.orderPrice) : saleOrderPrice;
    let combinedTotal: number | null =
      meta.combinedTotal != null ? Number(meta.combinedTotal) : null;
    if (
      combinedTotal == null &&
      orderPrice != null &&
      offerPrice != null &&
      r.type === "upsell"
    ) {
      combinedTotal = Math.round((orderPrice + offerPrice) * 100) / 100;
    }

    return {
    id: r.id,
    type: r.type,
    title: r.title,
    details: r.details,
    status: r.status,
    metadata: r.metadata,
    createdAt: r.createdAt,
      saleId,
      order: sale
        ? {
            saleId: sale.id,
            productType: sale.productType,
            price: sale.price,
            currency: "USD",
            status: sale.status,
          }
        : null,
      discountPercent,
      discountCode: (meta.discountCode as string) || null,
      validUntil: (meta.validUntil as string) || null,
      productName: (meta.productName as string) || null,
      offerPrice,
      originalPrice,
      discountedPrice,
      discountAmount,
      orderPrice,
      combinedTotal,
      customerResponse: (meta.customerResponse as string) || null,
      customerRespondedAt: (meta.customerRespondedAt as string) || null,
    };
  });
};

export const respondToCustomerOffer = async (
  portalCustomerId: number,
  brandId: number,
  engagementId: number,
  action: "interested" | "claim" = "claim"
) => {
  const accounts = await CustomerAccount.findAll({
    where: { portalCustomerId, brandId, status: "active" },
    attributes: ["id", "leadId", "saleId"],
  });
  const accountIds = accounts.map((a) => a.id);
  if (!accountIds.length) throw new Error("No customer account for this brand");

  const engagement = await CustomerEngagement.findOne({
    where: {
      id: engagementId,
      customerAccountId: { [Op.in]: accountIds },
      type: { [Op.in]: ["upsell", "discount"] },
    },
  });
  if (!engagement) throw new Error("Offer not found");

  const meta = parseEngagementMetadata(engagement.metadata);
  if (meta.customerResponse === action) {
    return {
      id: engagement.id,
      customerResponse: action,
      customerRespondedAt: meta.customerRespondedAt,
      alreadyResponded: true,
    };
  }

  const respondedAt = new Date().toISOString();
  const nextMeta = {
    ...meta,
    customerResponse: action,
    customerRespondedAt: respondedAt,
  };
  await engagement.update({ metadata: nextMeta });

  const account =
    accounts.find((a) => a.id === engagement.customerAccountId) || accounts[0];

  await logPortalActivityFromContext(
    { id: account.id, brandId },
    portalCustomerId,
    "offer_response",
    {
      title: portalActivityLabel("offer_response"),
      metadata: {
        engagementId: engagement.id,
        saleId: engagement.saleId,
        offerType: engagement.type,
        response: action,
        customerResponse: action,
      },
    }
  );

  if (action === "claim") {
    try {
      await notifyAgentsOnOfferClaim({
        portalCustomerId,
        engagement,
        account,
      });
    } catch (err) {
      console.error("Offer claim agent notification failed:", err);
    }
  }

  return {
    id: engagement.id,
    customerResponse: action,
    customerRespondedAt: respondedAt,
    alreadyResponded: false,
  };
};

export const listCustomerAnnouncements = async (
  portalCustomerId: number,
  brandId: number,
  _opts?: { skipActivityLog?: boolean }
) => {
  await getPortalContext(portalCustomerId, brandId);
  const rows = await PortalAnnouncement.findAll({
    where: { brandId, ...activeWindowWhere() },
    order: [["createdAt", "DESC"]],
    attributes: [
      "id",
      "title",
      "body",
      "linkUrl",
      "startsAt",
      "endsAt",
      "createdAt",
    ],
  });
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    body: r.body,
    linkUrl: r.linkUrl,
    startsAt: r.startsAt,
    endsAt: r.endsAt,
    createdAt: r.startsAt || r.createdAt,
  }));
};

export const listCustomerPopups = async (
  portalCustomerId: number,
  brandId: number
) => {
  await getPortalContext(portalCustomerId, brandId);
  const popups = await PortalPopup.findAll({
    where: { brandId, ...activeWindowWhere() },
    order: [
      ["priority", "DESC"],
      ["createdAt", "DESC"],
    ],
  });
  const dismissed = await PortalPopupDismissal.findAll({
    where: { portalCustomerId, brandId },
    attributes: ["popupId"],
  });
  const dismissedSet = new Set(dismissed.map((d) => d.popupId));
  return popups
    .filter((p) => !dismissedSet.has(p.id))
    .map((p) => ({
      id: p.id,
      title: p.title,
      body: p.body,
      imageUrl: p.imageUrl,
      ctaLabel: p.ctaLabel,
      ctaUrl: p.ctaUrl,
      priority: p.priority,
    }));
};

export const dismissCustomerPopup = async (
  portalCustomerId: number,
  brandId: number,
  popupId: number
) => {
  await getPortalContext(portalCustomerId, brandId);
  const popup = await PortalPopup.findOne({
    where: { id: popupId, brandId },
  });
  if (!popup) throw new Error("Popup not found");

  await PortalPopupDismissal.findOrCreate({
    where: { portalCustomerId, popupId },
    defaults: { portalCustomerId, popupId, brandId },
  });

  const account = await CustomerAccount.findOne({
    where: { portalCustomerId, brandId, status: "active" },
  });
  if (account) {
    void logPortalActivityFromContext(account, portalCustomerId, "dismiss_popup", {
      title: `Dismissed popup: ${popup.title || `#${popupId}`}`,
      metadata: { popupId, popupTitle: popup.title },
    });
  }

  return { dismissed: true, popupId };
};

const stripHtmlText = (text: unknown): string =>
  String(text || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export type CustomerActivityFeedItem = {
  id: number;
  feedType: "notification" | "announcement" | "offer";
  title: string;
  preview: string | null;
  createdAt: Date | string | null;
  unread?: boolean;
};

/** Paginated mixed feed for dashboard Recent activity (scroll to load more). */
export const listCustomerActivityFeed = async (
  portalCustomerId: number,
  brandId: number,
  opts: { page?: number; limit?: number } = {}
) => {
  await getPortalContext(portalCustomerId, brandId);

  const page = Math.max(1, Number(opts.page) || 1);
  const limit = Math.min(30, Math.max(1, Number(opts.limit) || 10));
  const offset = (page - 1) * limit;
  const fetchSize = offset + limit;

  const accounts = await CustomerAccount.findAll({
    where: { portalCustomerId, brandId, status: "active" },
    attributes: ["id"],
  });
  const accountIds = accounts.map((a) => a.id);

  const engagementWhere =
    accountIds.length > 0
      ? {
          customerAccountId: { [Op.in]: accountIds },
          type: { [Op.in]: ["notification", "upsell", "discount"] as const },
        }
      : null;

  const annWhere = { brandId, ...activeWindowWhere() };

  const [engagementTotal, annTotal] = await Promise.all([
    engagementWhere
      ? CustomerEngagement.count({ where: engagementWhere })
      : Promise.resolve(0),
    PortalAnnouncement.count({ where: annWhere }),
  ]);
  const total = engagementTotal + annTotal;

  const [engagements, announcements] = await Promise.all([
    engagementWhere
      ? CustomerEngagement.findAll({
          where: engagementWhere,
          order: [["createdAt", "DESC"]],
          limit: fetchSize,
          attributes: [
            "id",
            "type",
            "title",
            "details",
            "status",
            "metadata",
            "createdAt",
          ],
        })
      : Promise.resolve([]),
    PortalAnnouncement.findAll({
      where: annWhere,
      order: [["createdAt", "DESC"]],
      limit: fetchSize,
      attributes: ["id", "title", "body", "startsAt", "createdAt"],
    }),
  ]);

  type SortableRow = CustomerActivityFeedItem & { sortAt: number };

  const rows: SortableRow[] = [];

  for (const r of engagements) {
    const feedType = r.type === "notification" ? "notification" : "offer";
    const meta = (r.metadata || {}) as Record<string, unknown>;
    rows.push({
      id: r.id,
      feedType,
      title: r.title || (feedType === "offer" ? "Offer" : "Notification"),
      preview:
        stripHtmlText(r.details).slice(0, 120) ||
        (typeof meta.summary === "string" ? meta.summary : null),
      createdAt: r.createdAt,
      unread:
        r.type === "notification" &&
        !(r.status === "sent" || r.status === "applied"),
      sortAt: new Date(r.createdAt || 0).getTime(),
    });
  }

  for (const r of announcements) {
    rows.push({
      id: r.id,
      feedType: "announcement",
      title: r.title,
      preview: stripHtmlText(r.body).slice(0, 120) || null,
      createdAt: r.startsAt || r.createdAt,
      unread: false,
      sortAt: new Date(r.startsAt || r.createdAt || 0).getTime(),
    });
  }

  rows.sort((a, b) => b.sortAt - a.sortAt);
  const items = rows
    .slice(offset, offset + limit)
    .map(({ sortAt: _sortAt, ...item }) => item);

  return {
    items,
    page,
    limit,
    total,
    hasMore: offset + items.length < total,
  };
};

export const listCustomerNotifications = async (
  portalCustomerId: number,
  brandId: number,
  _opts?: { skipActivityLog?: boolean }
) => {
  const { account } = await getPortalContext(portalCustomerId, brandId);
  const rows = await CustomerEngagement.findAll({
    where: {
      customerAccountId: account.id,
      type: "notification",
    },
    order: [["createdAt", "DESC"]],
    limit: 50,
  });
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    details: r.details,
    status: r.status,
    metadata: r.metadata,
    createdAt: r.createdAt,
    read: r.status === "sent" || r.status === "applied",
  }));
};

export const getCustomerDashboardStats = async (
  portalCustomerId: number,
  brandId: number
) => {
  const { account, brand } = await getPortalContext(portalCustomerId, brandId);
  const { orders } = await listCustomerOrders(portalCustomerId, brandId);
  const offers = await listCustomerOffers(portalCustomerId, brandId);
  const notifications = await listCustomerNotifications(portalCustomerId, brandId);
  const announcements = await listCustomerAnnouncements(portalCustomerId, brandId);
  const popups = await listCustomerPopups(portalCustomerId, brandId);

  const ordersByStatus = {
    pending: 0,
    converted: 0,
    cancelled: 0,
  };
  let totalSpent = 0;
  for (const o of orders) {
    const st = String(o.status || "pending").toLowerCase();
    if (st in ordersByStatus) {
      ordersByStatus[st as keyof typeof ordersByStatus] += 1;
    }
    if (st === "converted" && o.price != null) {
      totalSpent += Number(o.price) || 0;
    }
  }

  const unreadNotifications = notifications.filter((n) => !n.read).length;

  let invoicesPaid = 0;
  let invoicesPending = 0;
  for (const o of orders) {
    const st = String(o.status || "pending").toLowerCase();
    if (st === "converted") invoicesPaid += 1;
    else if (st !== "cancelled") invoicesPending += 1;
  }

  const recent = orders[0] || null;

  return {
    brand: {
      id: brand.id,
      name: brand.name,
      slug: brand.slug,
    },
    accountId: account.id,
    orders: {
      total: orders.length,
      active: ordersByStatus.converted + ordersByStatus.pending,
      pending: ordersByStatus.pending,
      converted: ordersByStatus.converted,
      cancelled: ordersByStatus.cancelled,
    },
    invoices: {
      total: orders.length,
      paid: invoicesPaid,
      pending: invoicesPending,
    },
    offers: { total: offers.length, active: offers.length },
    notifications: {
      total: notifications.length,
      unread: unreadNotifications,
    },
    announcements: { active: announcements.length, total: announcements.length },
    popups: { visible: popups.length, total: popups.length },
    totalSpent: Math.round(totalSpent * 100) / 100,
    recentOrder: recent
      ? {
          saleId: recent.saleId,
          productType: recent.productType,
          status: recent.status,
          conversionDate: recent.conversionDate,
          price: recent.price,
          campaignName: recent.campaignName,
          progress: recent.progress,
        }
      : null,
  };
};

const TRACKABLE_ACTIONS = new Set<PortalActivityAction>([
  "dashboard_view",
  "view_orders",
  "view_invoices",
  "view_offers",
  "view_announcements",
  "view_notifications",
  "view_order",
  "download_invoice",
]);

/** Explicit activity from portal (page visit, download, etc.) — not from bulk data prefetch. */
export const trackCustomerPortalActivity = async (
  portalCustomerId: number,
  brandId: number,
  input: {
    action: string;
    title?: string;
    metadata?: Record<string, unknown> | null;
  }
) => {
  const action = String(input.action || "").trim() as PortalActivityAction;
  if (!TRACKABLE_ACTIONS.has(action)) {
    throw new Error("Invalid activity action");
  }

  const { account } = await getPortalContext(portalCustomerId, brandId);
  const metadata = input.metadata ?? null;
  const saleId = metadata?.saleId != null ? Number(metadata.saleId) : null;

  let title = input.title?.trim();
  if (!title) {
    if (action === "download_invoice" && saleId) {
      title = `Downloaded invoice for order #${saleId}`;
    } else if (action === "view_order" && saleId) {
      title = `Viewed order #${saleId}`;
    } else {
      title = portalActivityLabel(action);
    }
  }

  await logPortalActivityFromContext(account, portalCustomerId, action, {
    title,
    metadata,
    skipDedupe: action === "download_invoice",
  });

  return { logged: true, action };
};

export const extractBrandIdFromCustomerToken = (
  token: string
): number | null => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as {
      brandId?: number;
    };
    const n = Number(decoded?.brandId);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
};
