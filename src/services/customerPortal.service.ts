import { Op } from "sequelize";
import jwt from "jsonwebtoken";
import Brand from "../models/brand.model";
import CustomerAccount from "../models/customerAccount.model";
import CustomerEngagement from "../models/customerEngagement.model";
import PortalAnnouncement from "../models/portalAnnouncement.model";
import PortalPopup from "../models/portalPopup.model";
import PortalPopupDismissal from "../models/portalPopupDismissal.model";
import ProductSale from "../models/product.model";
import Lead from "../models/lead.model";
import { resolvePortalBrand } from "../utils/portalHost";

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
  const salesFormConfig = (brand.salesFormConfig || {}) as Record<string, unknown>;
  const portalTheme =
    (salesFormConfig.portalTheme as Record<string, unknown>) ||
    (salesFormConfig.theme as Record<string, unknown>) ||
    {};

  return {
    id: brand.id,
    name: brand.name,
    slug: brand.slug,
    subdomain: brand.subdomain,
    customerPortalUrl: brand.customerPortalUrl,
    portalTheme: {
      logoUrl: portalTheme.logoUrl ?? null,
      primaryColor: portalTheme.primaryColor ?? "#2563eb",
      supportEmail: portalTheme.supportEmail ?? null,
      supportPhone: portalTheme.supportPhone ?? null,
      services: Array.isArray(portalTheme.services)
        ? portalTheme.services
        : Array.isArray(salesFormConfig.services)
          ? salesFormConfig.services
          : [],
      ...portalTheme,
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

const requireAccountForBrand = async (userId: number, brandId: number) => {
  const account = await CustomerAccount.findOne({
    where: { userId, brandId, status: "active" },
  });
  if (!account) throw new Error("No customer account for this brand");
  return account;
};

export const getPortalContext = async (userId: number, brandId: number) => {
  const account = await requireAccountForBrand(userId, brandId);
  const brand = await Brand.findByPk(brandId);
  if (!brand) throw new Error("Brand not found");
  return { account, brand };
};

export const listCustomerOrders = async (userId: number, brandId: number) => {
  const { account } = await getPortalContext(userId, brandId);
  const accountFilter: any = { userId, status: "active" };
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
  userId: number,
  brandId: number,
  saleId: number
) => {
  await getPortalContext(userId, brandId);
  const sale = await ProductSale.findByPk(saleId);
  if (!sale) throw new Error("Order not found");

  const account = await CustomerAccount.findOne({
    where: { userId, saleId, status: "active" },
  });
  if (!account) throw new Error("Order not linked to your account");

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

export const listCustomerInvoices = async (userId: number, brandId: number) => {
  const { orders } = await listCustomerOrders(userId, brandId);
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

export const listCustomerOffers = async (userId: number, brandId: number) => {
  const { account } = await getPortalContext(userId, brandId);
  const rows = await CustomerEngagement.findAll({
    where: {
      customerAccountId: account.id,
      type: { [Op.in]: ["upsell", "discount"] },
      status: { [Op.in]: ["active", "sent", "applied"] },
    },
    order: [["createdAt", "DESC"]],
    limit: 50,
  });
  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    title: r.title,
    details: r.details,
    status: r.status,
    metadata: r.metadata,
    createdAt: r.createdAt,
  }));
};

export const listCustomerAnnouncements = async (brandId: number) => {
  return PortalAnnouncement.findAll({
    where: { brandId, ...activeWindowWhere() },
    order: [["createdAt", "DESC"]],
    attributes: ["id", "title", "body", "linkUrl", "startsAt", "endsAt"],
  });
};

export const listCustomerPopups = async (
  userId: number,
  brandId: number
) => {
  await getPortalContext(userId, brandId);
  const popups = await PortalPopup.findAll({
    where: { brandId, ...activeWindowWhere() },
    order: [
      ["priority", "DESC"],
      ["createdAt", "DESC"],
    ],
  });
  const dismissed = await PortalPopupDismissal.findAll({
    where: { userId, brandId },
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
  userId: number,
  brandId: number,
  popupId: number
) => {
  await getPortalContext(userId, brandId);
  const popup = await PortalPopup.findOne({
    where: { id: popupId, brandId },
  });
  if (!popup) throw new Error("Popup not found");

  await PortalPopupDismissal.findOrCreate({
    where: { userId, popupId },
    defaults: { userId, popupId, brandId },
  });
  return { dismissed: true, popupId };
};

export const listCustomerNotifications = async (
  userId: number,
  brandId: number
) => {
  const { account } = await getPortalContext(userId, brandId);
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
  userId: number,
  brandId: number
) => {
  const { account, brand } = await getPortalContext(userId, brandId);
  const { orders } = await listCustomerOrders(userId, brandId);
  const offers = await listCustomerOffers(userId, brandId);
  const notifications = await listCustomerNotifications(userId, brandId);
  const announcements = await listCustomerAnnouncements(brandId);
  const popups = await listCustomerPopups(userId, brandId);

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
