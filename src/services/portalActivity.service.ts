import { Op } from "sequelize";
import "../models/associations";
import PortalActivityEvent, {
  PortalActivityAction,
} from "../models/portalActivityEvent.model";
import CustomerAccount from "../models/customerAccount.model";
import User from "../models/user.model";
import PortalPopupDismissal from "../models/portalPopupDismissal.model";
import PortalPopup from "../models/portalPopup.model";

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
};

/** Always log these; others dedupe within window per account. */
const ALWAYS_LOG_ACTIONS = new Set<PortalActivityAction>([
  "login",
  "view_order",
  "dismiss_popup",
]);

const DEDUPE_WINDOW_MS = 30 * 60 * 1000;

const shouldSkipDuplicateActivity = async (input: {
  customerAccountId: number;
  action: PortalActivityAction;
}) => {
  if (ALWAYS_LOG_ACTIONS.has(input.action)) return false;
  const since = new Date(Date.now() - DEDUPE_WINDOW_MS);
  const recent = await PortalActivityEvent.findOne({
    where: {
      customerAccountId: input.customerAccountId,
      action: input.action,
      createdAt: { [Op.gte]: since },
    },
    attributes: ["id"],
  });
  return !!recent;
};

export const portalActivityLabel = (action: string) =>
  ACTION_LABELS[action as PortalActivityAction] || action;

/** Fire-and-forget safe portal event log. */
export const logPortalActivity = async (input: {
  customerAccountId: number;
  userId: number;
  brandId?: number | null;
  action: PortalActivityAction;
  title?: string;
  metadata?: Record<string, unknown> | null;
}) => {
  try {
    if (await shouldSkipDuplicateActivity(input)) return;

    await PortalActivityEvent.create({
      customerAccountId: input.customerAccountId,
      userId: input.userId,
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
  userId: number,
  action: PortalActivityAction,
  opts?: { title?: string; metadata?: Record<string, unknown> | null }
) =>
  logPortalActivity({
    customerAccountId: account.id,
    userId,
    brandId: account.brandId ?? null,
    action,
    title: opts?.title,
    metadata: opts?.metadata,
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
    const seenActions = new Set<string>();
    const activities = current.filter((item) => {
      if (item.action === "login") return true;
      if (seenActions.has(item.action)) return false;
      seenActions.add(item.action);
      return true;
    });

    sessions.push({
      id: loginEvent?.id || `session-${startedAt}`,
      startedAt,
      loginEvent,
      activities,
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
        model: User,
        as: "user",
        attributes: ["id", "email", "firstname", "lastname", "last_login"],
      },
    ],
  });
  if (!account) throw new Error("Customer account not found");

  const user = (account as any).user as InstanceType<typeof User> | undefined;
  const userId = account.userId;

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
    (user?.last_login ? new Date(user.last_login).toISOString() : null);

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
    attributes: ["id", "userId", "brandId"],
  });
  if (!account) return [];

  const dismissals = await PortalPopupDismissal.findAll({
    where: {
      userId: account.userId,
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
