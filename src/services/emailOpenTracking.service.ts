import crypto from "crypto";
import { Op } from "sequelize";
import "../models/associations";
import EmailLog from "../models/emailLog.model";
import CustomerAccount from "../models/customerAccount.model";
import PortalCustomer from "../models/portalCustomer.model";
import Brand from "../models/brand.model";
import ProductSale from "../models/product.model";
import {
  resolveCustomerListScope,
  buildCustomerAccountSaleScopeWhere,
} from "../utils/customerAccountScope";
import { getCustomerEmailAssetBaseUrl } from "../utils/customerEmailBrandTheme";

/** 1×1 transparent GIF */
export const TRACKING_PIXEL_GIF = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

export const generateEmailOpenToken = (): string =>
  crypto.randomBytes(24).toString("hex");

export const getEmailTrackingBaseUrl = (): string =>
  getCustomerEmailAssetBaseUrl().replace(/\/$/, "");

export const buildEmailOpenTrackingUrl = (token: string): string =>
  `${getEmailTrackingBaseUrl()}/api/email-track/open/${encodeURIComponent(token)}.gif`;

const PIXEL_MARKER = "data-xcrm-open-track";

/** Inject invisible open-tracking pixel into HTML (idempotent). */
export const injectOpenTrackingPixel = (
  html: string,
  token: string
): string => {
  const raw = String(html || "");
  if (!token || !raw) return raw;
  if (raw.includes(PIXEL_MARKER) || raw.includes(`/api/email-track/open/`)) {
    return raw;
  }

  const url = buildEmailOpenTrackingUrl(token);
  const pixel = `<img src="${url}" width="1" height="1" alt="" ${PIXEL_MARKER}="1" style="display:block;width:1px;height:1px;border:0;outline:none;" />`;

  if (/<\/body>/i.test(raw)) {
    return raw.replace(/<\/body>/i, `${pixel}</body>`);
  }
  return `${raw}${pixel}`;
};

export type TrackOpenOptions = {
  serviceName: string;
  customerAccountId?: number | null;
};

/**
 * Prepare HTML with open pixel. Token is returned so EmailLog can be created after a successful send.
 */
export const prepareOpenTrackingForSend = (
  html: string
): { trackedHtml: string; openToken: string } => {
  const openToken = generateEmailOpenToken();
  const trackedHtml = injectOpenTrackingPixel(html, openToken);
  const pixelUrl = buildEmailOpenTrackingUrl(openToken);
  if (/localhost|127\.0\.0\.1/i.test(pixelUrl)) {
    console.warn(
      `[email-track] Pixel URL is not publicly reachable: ${pixelUrl}. Set BACKEND_PUBLIC_URL (e.g. https://xcrm.live) so Gmail can record opens.`
    );
  } else {
    console.log(`[email-track] Open pixel ready: ${pixelUrl.slice(0, 80)}…`);
  }
  return { openToken, trackedHtml };
};

/** Persist EmailLog after a successful send (with open token already in HTML). */
export const createTrackedEmailLogAfterSend = async (params: {
  to: string;
  subject: string;
  body: string;
  serviceName: string;
  customerAccountId?: number | null;
  openToken: string;
}): Promise<{ emailLogId: number }> => {
  const row = await EmailLog.create({
    to: params.to,
    subject: params.subject,
    body: params.body,
    status: "sent",
    serviceName: params.serviceName,
    sentAt: new Date(),
    openToken: params.openToken,
    openedAt: null,
    openCount: 0,
    customerAccountId: params.customerAccountId ?? null,
  });
  return { emailLogId: Number(row.get("id")) };
};

/**
 * @deprecated Prefer prepareOpenTrackingForSend + createTrackedEmailLogAfterSend
 * so failed sends are not logged as sent.
 */
export const prepareTrackedCustomerEmail = async (params: {
  to: string;
  subject: string;
  body: string;
  serviceName: string;
  customerAccountId?: number | null;
}): Promise<{ trackedHtml: string; emailLogId: number; openToken: string }> => {
  const { trackedHtml, openToken } = prepareOpenTrackingForSend(params.body);
  const { emailLogId } = await createTrackedEmailLogAfterSend({
    ...params,
    body: trackedHtml,
    openToken,
  });
  return { trackedHtml, emailLogId, openToken };
};

/** Public open-pixel hit — marks email opened (idempotent first open). */
export const recordEmailOpenByToken = async (
  token: string
): Promise<{ recorded: boolean }> => {
  const clean = String(token || "")
    .replace(/\.gif$/i, "")
    .trim();
  if (!clean || clean.length < 16 || clean.length > 64) {
    return { recorded: false };
  }

  const row = await EmailLog.findOne({ where: { openToken: clean } });
  if (!row) return { recorded: false };

  const now = new Date();
  const updates: Record<string, unknown> = {
    openCount: (Number(row.get("openCount")) || 0) + 1,
  };

  const status = String(row.get("status") || "").toLowerCase();
  const alreadyOpened = status === "opened" || Boolean(row.get("openedAt"));
  if (!alreadyOpened) {
    updates.status = "opened";
    updates.openedAt = now;
  }

  await row.update(updates);
  return { recorded: true };
};

const pagingMeta = (page: number, limit: number, total: number) => ({
  currentPage: page,
  pageSize: limit,
  totalItems: total,
  totalPages: Math.max(1, Math.ceil(total / limit) || 1),
});

/** CRM feed: recently opened customer emails (scoped). */
export const listRecentEmailOpens = async ({
  page = 1,
  limit = 20,
  brandId,
  search,
  dateFrom,
  dateTo,
  openedOnly = false,
  viewerUserId,
  viewerPermissions = [],
}: {
  page?: number;
  limit?: number;
  brandId?: number;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  openedOnly?: boolean;
  viewerUserId: number;
  viewerPermissions?: string[];
}) => {
  const safePage = Math.max(1, page);
  const safeLimit = Math.min(50, Math.max(5, limit));
  const offset = (safePage - 1) * safeLimit;

  const scopeResult = await resolveCustomerListScope(
    viewerUserId,
    viewerPermissions
  );
  const saleScope = buildCustomerAccountSaleScopeWhere(scopeResult);

  // Show all tracked emails (those with an open-tracking token) so sent
  // emails appear immediately; opened ones are flagged via openedAt.
  const where: Record<string, unknown> = {
    openToken: { [Op.ne]: null },
  };
  if (openedOnly) {
    where.openedAt = { [Op.ne]: null };
  }

  if (dateFrom?.trim() || dateTo?.trim()) {
    const range: { [Op.gte]?: Date; [Op.lte]?: Date } = {};
    if (dateFrom?.trim()) {
      const from = new Date(`${dateFrom.trim()}T00:00:00.000`);
      if (!Number.isNaN(from.getTime())) range[Op.gte] = from;
    }
    if (dateTo?.trim()) {
      const to = new Date(`${dateTo.trim()}T23:59:59.999`);
      if (!Number.isNaN(to.getTime())) range[Op.lte] = to;
    }
    if (range[Op.gte] || range[Op.lte]) {
      where.sentAt = range;
    }
  }

  const accountWhere: Record<string, unknown> = {};
  if (brandId != null && Number.isFinite(brandId)) {
    accountWhere.brandId = brandId;
  }

  const portalCustomerWhere: Record<string, unknown> | undefined = search?.trim()
    ? {
        [Op.or]: [
          { email: { [Op.like]: `%${search.trim()}%` } },
          { firstname: { [Op.like]: `%${search.trim()}%` } },
          { lastname: { [Op.like]: `%${search.trim()}%` } },
        ],
      }
    : undefined;

  const result = await EmailLog.findAndCountAll({
    where,
    order: [["sentAt", "DESC"]],
    offset,
    limit: safeLimit,
    distinct: true,
    subQuery: false,
    include: [
      {
        model: CustomerAccount,
        as: "customerAccount",
        required: false,
        where: Object.keys(accountWhere).length ? accountWhere : undefined,
        attributes: ["id", "brandId", "leadId", "saleId"],
        include: [
          {
            model: PortalCustomer,
            as: "portalCustomer",
            attributes: ["id", "firstname", "lastname", "email"],
            required: !!portalCustomerWhere,
            where: portalCustomerWhere,
          },
          {
            model: Brand,
            as: "brand",
            required: false,
            attributes: ["id", "name"],
          },
          {
            model: ProductSale,
            as: "sale",
            required: scopeResult.scope !== "all",
            where: saleScope || undefined,
            attributes: ["id", "assigneeId", "createdBy"],
          },
        ],
      },
    ],
  });

  // Also match by recipient email when customerAccountId is null (legacy rows)
  // — primary path uses customerAccount association.

  const data = result.rows.map((row) => {
    const plain = row.get({ plain: true }) as any;
    const account = plain.customerAccount || {};
    const pc = account.portalCustomer || {};
    const brand = account.brand || null;
    const openToken = plain.openToken ? String(plain.openToken) : null;
    const trackingPixelUrl = openToken
      ? buildEmailOpenTrackingUrl(openToken)
      : null;
    // What was actually baked into the email at send time (may differ from current env)
    const bodyStr = String(plain.body || "");
    const bakedMatch = bodyStr.match(
      /https?:\/\/[^"'>\s]+\/api\/email-track\/open\/[^"'>\s]+/i
    );
    return {
      id: plain.id,
      subject: plain.subject,
      to: plain.to,
      serviceName: plain.serviceName,
      status: plain.status,
      sentAt: plain.sentAt
        ? new Date(plain.sentAt).toISOString()
        : null,
      openedAt: plain.openedAt
        ? new Date(plain.openedAt).toISOString()
        : null,
      opened: !!plain.openedAt,
      openCount: Number(plain.openCount) || 0,
      customerAccountId: account.id || plain.customerAccountId || null,
      trackingPixelUrl,
      pixelUrlInEmail: bakedMatch?.[0] || null,
      brand: brand ? { id: brand.id, name: brand.name } : null,
      customer: {
        email: pc.email || plain.to || null,
        firstname: pc.firstname || null,
        lastname: pc.lastname || null,
        name: [pc.firstname, pc.lastname].filter(Boolean).join(" ") || null,
      },
    };
  });

  return {
    data,
    scope: scopeResult.scope,
    ...pagingMeta(safePage, safeLimit, result.count),
  };
};
