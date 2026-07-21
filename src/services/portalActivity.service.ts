import { Op } from "sequelize";
import "../models/associations";
import PortalActivityEvent, {
  PortalActivityAction,
} from "../models/portalActivityEvent.model";
import CustomerAccount from "../models/customerAccount.model";
import PortalCustomer from "../models/portalCustomer.model";
import PortalPopupDismissal from "../models/portalPopupDismissal.model";
import PortalPopup from "../models/portalPopup.model";
import Brand from "../models/brand.model";
import ProductSale from "../models/product.model";
import {
  resolveCustomerListScope,
  buildCustomerAccountSaleScopeWhere,
} from "../utils/customerAccountScope";

const ACTION_LABELS: Record<PortalActivityAction, string> = {
  login: "Portal login",
  dashboard_view: "Viewed dashboard",
  view_orders: "Viewed orders",
  view_invoices: "Viewed invoices",
  view_offers: "Viewed offers",
  view_announcements: "Viewed announcements",
  view_notifications: "Viewed notifications",
  view_order: "Viewed order progress",
  dismiss_popup: "Dismissed popup",
  download_invoice: "Downloaded invoice",
  view_services: "Viewed services",
  service_form_submitted: "Submitted service form",
  offer_response: "Responded to offer",
};

/** Log every time — e.g. each login session, each invoice download. */
const ALWAYS_LOG_ACTIONS = new Set<PortalActivityAction>([
  "login",
  "download_invoice",
  "service_form_submitted",
  "offer_response",
]);

/** Log once per customer account; repeat visits are not shown in activity. */
const ONCE_PER_ACCOUNT_ACTIONS = new Set<PortalActivityAction>([
  "dashboard_view",
  "view_orders",
  "view_invoices",
  "view_offers",
  "view_announcements",
  "view_notifications",
]);

const metadataEntityKey = (action: PortalActivityAction): string | null => {
  if (action === "view_order") return "saleId";
  if (action === "dismiss_popup") return "popupId";
  if (action === "offer_response") return "engagementId";
  return null;
};

const metadataMatches = (
  stored: Record<string, unknown> | null | undefined,
  key: string,
  value: unknown
) => {
  if (!stored || value == null) return false;
  const left = stored[key];
  if (left === value) return true;
  const leftNum = Number(left);
  const rightNum = Number(value);
  return Number.isFinite(leftNum) && Number.isFinite(rightNum) && leftNum === rightNum;
};

const hasExistingEntityActivity = async (input: {
  customerAccountId: number;
  action: PortalActivityAction;
  metadata?: Record<string, unknown> | null;
}) => {
  const entityKey = metadataEntityKey(input.action);
  if (!entityKey) return false;
  const entityValue = input.metadata?.[entityKey];
  if (entityValue == null) return false;

  const rows = await PortalActivityEvent.findAll({
    where: {
      customerAccountId: input.customerAccountId,
      action: input.action,
    },
    attributes: ["id", "metadata"],
    limit: 200,
  });

  return rows.some((row) =>
    metadataMatches(row.metadata as Record<string, unknown> | null, entityKey, entityValue)
  );
};

const shouldSkipDuplicateActivity = async (input: {
  customerAccountId: number;
  action: PortalActivityAction;
  skipDedupe?: boolean;
  metadata?: Record<string, unknown> | null;
}) => {
  if (input.skipDedupe || ALWAYS_LOG_ACTIONS.has(input.action)) return false;

  if (ONCE_PER_ACCOUNT_ACTIONS.has(input.action)) {
    const existing = await PortalActivityEvent.findOne({
      where: {
        customerAccountId: input.customerAccountId,
        action: input.action,
      },
      attributes: ["id"],
    });
    return !!existing;
  }

  const entityKey = metadataEntityKey(input.action);
  if (entityKey) {
    return hasExistingEntityActivity(input);
  }

  return false;
};

export const portalActivityLabel = (action: string) =>
  ACTION_LABELS[action as PortalActivityAction] || action;

/** Fire-and-forget safe portal event log. */
export const logPortalActivity = async (input: {
  customerAccountId: number;
  portalCustomerId: number;
  brandId?: number | null;
  action: PortalActivityAction;
  title?: string;
  metadata?: Record<string, unknown> | null;
  skipDedupe?: boolean;
}) => {
  try {
    if (await shouldSkipDuplicateActivity(input)) return;

    await PortalActivityEvent.create({
      customerAccountId: input.customerAccountId,
      portalCustomerId: input.portalCustomerId,
      brandId: input.brandId ?? null,
      action: input.action,
      title: input.title || ACTION_LABELS[input.action] || input.action,
      metadata: input.metadata ?? null,
    });
  } catch (err) {
    console.warn("portal activity log failed:", (err as Error)?.message || err);
  }
};

export const logPortalActivityFromContext = async (
  account: { id: number; brandId?: number | null },
  portalCustomerId: number,
  action: PortalActivityAction,
  opts?: {
    title?: string;
    metadata?: Record<string, unknown> | null;
    skipDedupe?: boolean;
  }
) =>
  logPortalActivity({
    customerAccountId: account.id,
    portalCustomerId,
    brandId: account.brandId ?? null,
    action,
    title: opts?.title,
    metadata: opts?.metadata,
    skipDedupe: opts?.skipDedupe,
  });

const pagingMeta = (page: number, limit: number, total: number) => ({
  currentPage: page,
  pageSize: limit,
  totalItems: total,
  totalPages: Math.max(1, Math.ceil(total / limit) || 1),
});

type FeedItem = {
  id: string;
  action: string;
  title: string;
  at: string;
  metadata?: Record<string, unknown> | null;
  source: "event" | "legacy";
};

const mapEventRow = (row: PortalActivityEvent): FeedItem => ({
  id: `event-${row.id}`,
  action: row.action,
  title: row.title,
  at: row.createdAt.toISOString(),
  metadata: row.metadata ?? null,
  source: "event",
});

export type PortalActivitySession = {
  id: string;
  startedAt: string;
  loginEvent: FeedItem | null;
  activities: FeedItem[];
};

/** Group flat events into login sessions (newest session first). */
export const buildPortalActivitySessions = (
  events: FeedItem[]
): PortalActivitySession[] => {
  const sorted = [...events].sort(
    (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime()
  );

  const sessions: PortalActivitySession[] = [];
  let current: FeedItem[] = [];

  const pushSession = () => {
    if (!current.length) return;
    const loginEvent = current.find((e) => e.action === "login") || null;
    const startedAt = loginEvent?.at || current[0].at;

    sessions.push({
      id: loginEvent?.id || `session-${startedAt}`,
      startedAt,
      loginEvent,
      activities: [...current],
    });
    current = [];
  };

  for (const event of sorted) {
    if (event.action === "login") {
      pushSession();
      current = [event];
    } else {
      current.push(event);
    }
  }
  pushSession();

  return sessions.reverse();
};

/** Staff CRM feed for one customer account. */
export const getCustomerPortalActivity = async (
  accountId: number,
  page = 1,
  limit = 30
) => {
  const safePage = Math.max(1, page);
  const safeLimit = Math.min(50, Math.max(5, limit));

  const account = await CustomerAccount.findByPk(accountId, {
    include: [
      {
        model: PortalCustomer,
        as: "portalCustomer",
        attributes: ["id", "email", "firstname", "lastname", "last_login"],
      },
    ],
  });
  if (!account) throw new Error("Customer account not found");

  const portalCustomer = (account as any).portalCustomer as
    | InstanceType<typeof PortalCustomer>
    | undefined;

  const eventResult = await PortalActivityEvent.findAndCountAll({
    where: { customerAccountId: accountId },
    order: [["createdAt", "DESC"]],
    limit: safeLimit,
    offset: (safePage - 1) * safeLimit,
  });

  const events = eventResult.rows.map(mapEventRow);

  let mergedEvents = events;
  if (safePage === 1) {
    const legacy = await getLegacyPortalActivityPreview(accountId, 5);
    if (legacy.length) {
      mergedEvents = [...events, ...legacy].sort(
        (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()
      );
    }
  }

  const lastLoginEvent = await PortalActivityEvent.findOne({
    where: { customerAccountId: accountId, action: "login" },
    order: [["createdAt", "DESC"]],
    attributes: ["createdAt"],
  });

  const lastPortalLogin =
    lastLoginEvent?.createdAt?.toISOString() ||
    (portalCustomer?.last_login
      ? new Date(portalCustomer.last_login).toISOString()
      : null);

  const totalEvents = eventResult.count;

  const actionCounts = await PortalActivityEvent.findAll({
    where: { customerAccountId: accountId },
    attributes: [
      "action",
      [
        PortalActivityEvent.sequelize!.fn(
          "COUNT",
          PortalActivityEvent.sequelize!.col("id")
        ),
        "count",
      ],
    ],
    group: ["action"],
    raw: true,
  });

  const byAction: Record<string, number> = {};
  for (const row of actionCounts as any[]) {
    byAction[String(row.action)] = Number(row.count) || 0;
  }

  return {
    summary: {
      lastPortalLogin,
      totalEvents,
      loginCount: byAction.login || 0,
      ordersViews: byAction.view_orders || 0,
      invoicesViews: byAction.view_invoices || 0,
      offersViews: byAction.view_offers || 0,
      popupDismissals: byAction.dismiss_popup || 0,
      invoiceDownloads: byAction.download_invoice || 0,
    },
    events: mergedEvents,
    sessions: buildPortalActivitySessions(mergedEvents),
    pagination: pagingMeta(safePage, safeLimit, totalEvents),
  };
};

/** One-time style backfill items for CRM (popup dismissals before event logging). */
export const getLegacyPortalActivityPreview = async (
  accountId: number,
  limit = 10
): Promise<FeedItem[]> => {
  const account = await CustomerAccount.findByPk(accountId, {
    attributes: ["id", "portalCustomerId", "brandId"],
  });
  if (!account) return [];

  const dismissals = await PortalPopupDismissal.findAll({
    where: {
      portalCustomerId: account.portalCustomerId,
      ...(account.brandId ? { brandId: account.brandId } : {}),
    },
    order: [["createdAt", "DESC"]],
    limit,
  });

  if (!dismissals.length) return [];

  const popupIds = dismissals.map((d) => d.popupId);
  const popups = await PortalPopup.findAll({
    where: { id: { [Op.in]: popupIds } },
    attributes: ["id", "title"],
  });
  const popupTitle = new Map(popups.map((p) => [p.id, p.title]));

  const existingDismiss = await PortalActivityEvent.count({
    where: {
      customerAccountId: accountId,
      action: "dismiss_popup",
    },
  });
  if (existingDismiss > 0) return [];

  return dismissals.map((d) => ({
    id: `legacy-dismiss-${d.id}`,
    action: "dismiss_popup",
    title: `Dismissed popup: ${popupTitle.get(d.popupId) || `#${d.popupId}`}`,
    at: d.createdAt.toISOString(),
    metadata: { popupId: d.popupId, legacy: true },
    source: "legacy" as const,
  }));
};

/** CRM feed: recent portal activity across customers (scoped like customer list). */
export const listRecentPortalActivity = async ({
  page = 1,
  limit = 20,
  brandId,
  search,
  dateFrom,
  dateTo,
  customerAccountId,
  viewerUserId,
  viewerPermissions = [],
}: {
  page?: number;
  limit?: number;
  brandId?: number;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  customerAccountId?: number;
  viewerUserId: number;
  viewerPermissions?: string[];
}) => {
  const safePage = Math.max(1, page);
  const safeLimit = Math.min(50, Math.max(5, limit));
  const offset = (safePage - 1) * safeLimit;

  const scopeResult = await resolveCustomerListScope(
    viewerUserId,
    viewerPermissions,
  );
  const saleScope = buildCustomerAccountSaleScopeWhere(scopeResult);

  const eventWhere: Record<string, unknown> = {};
  if (
    customerAccountId != null &&
    Number.isFinite(customerAccountId) &&
    customerAccountId > 0
  ) {
    eventWhere.customerAccountId = customerAccountId;
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
      eventWhere.createdAt = range;
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

  const result = await PortalActivityEvent.findAndCountAll({
    where: Object.keys(eventWhere).length ? eventWhere : undefined,
    order: [["createdAt", "DESC"]],
    offset,
    limit: safeLimit,
    distinct: true,
    subQuery: false,
    include: [
      {
        model: CustomerAccount,
        as: "customerAccount",
        required: true,
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

  const data = result.rows.map((row) => {
    const plain = row.get({ plain: true }) as any;
    const account = plain.customerAccount || {};
    const pc = account.portalCustomer || {};
    const brand = account.brand || null;
    return {
      id: plain.id,
      action: plain.action,
      title: plain.title,
      at: plain.createdAt
        ? new Date(plain.createdAt).toISOString()
        : null,
      metadata: plain.metadata ?? null,
      customerAccountId: account.id,
      leadId: account.leadId ?? null,
      brand: brand ? { id: brand.id, name: brand.name } : null,
      customer: {
        email: pc.email || null,
        firstname: pc.firstname || null,
        lastname: pc.lastname || null,
        name: [pc.firstname, pc.lastname].filter(Boolean).join(" ") || null,
      },
    };
  });

  return {
    data,
    scope: scopeResult.scope,
    totalItems: result.count,
    currentPage: safePage,
    pageSize: safeLimit,
    totalPages: Math.max(1, Math.ceil(result.count / safeLimit) || 1),
  };
};
