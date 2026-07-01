import "../models/associations";
import "../models/index";
import { Op } from "sequelize";
import CustomerAccount from "../models/customerAccount.model";
import CustomerEngagement from "../models/customerEngagement.model";
import PortalCustomer from "../models/portalCustomer.model";
import User from "../models/user.model";
import Brand from "../models/brand.model";
import Lead from "../models/lead.model";
import ProductSale from "../models/product.model";
import EmailLog from "../models/emailLog.model";
import LeadActivity from "../models/leadActivity.model";
import PortalActivityEvent from "../models/portalActivityEvent.model";
import { getNotesForEntity } from "./note.service";
import {
  attachPortalCustomerAsUser,
  mapPortalCustomerAsUser,
} from "../utils/portalCustomerResponse";
import {
  buildCustomerAccountSaleScopeWhere,
  buildEngagementCreatedByScopeWhere,
  resolveCustomerListScope,
  type CustomerListScope,
} from "../utils/customerAccountScope";

const accountIncludes = [
  {
    model: PortalCustomer,
    as: "portalCustomer",
    attributes: ["id", "firstname", "lastname", "email", "status"],
  },
  { model: Brand, as: "brand", required: false },
  { model: Lead, as: "lead", required: false },
  { model: ProductSale, as: "sale", required: false },
];

const fetchCustomerAccountById = async (id: number) => {
  const account = await CustomerAccount.findByPk(id, { include: accountIncludes });
  if (!account) throw new Error("Customer account not found");
  return account;
};

const classifyEmail = (log: { subject?: string; serviceName?: string; body?: string }) => {
  const hay = `${log.subject || ""} ${log.serviceName || ""} ${log.body || ""}`.toLowerCase();
  if (/welcome|credential|portal|password|login/.test(hay)) return "credentials";
  if (/promo|promotion|offer|discount|campaign|newsletter|upsell/.test(hay)) return "promotional";
  return "transactional";
};

const emailDeliveryLabel = (status?: string) => {
  const s = String(status || "").toLowerCase();
  if (!s) return "unknown";
  if (/open|read|viewed/.test(s)) return "opened";
  if (/deliver|sent|success/.test(s)) return "sent";
  if (/fail|bounce|error/.test(s)) return "failed";
  return s;
};

const pagingMeta = (page: number, limit: number, total: number) => ({
  currentPage: page,
  pageSize: limit,
  totalItems: total,
  totalPages: Math.max(1, Math.ceil(total / limit) || 1),
});

export type InsightsQuery = {
  emailsPage?: number;
  emailsLimit?: number;
  engagementsPage?: number;
  engagementsLimit?: number;
  timelinePage?: number;
  timelineLimit?: number;
  activitiesPage?: number;
  activitiesLimit?: number;
};

export type InsightsViewer = {
  viewerUserId?: number;
  viewerPermissions?: string[];
};

const ENGAGEMENT_ACTION_TYPES = [
  "promotional_email",
  "upsell",
  "discount",
  "notification",
] as const;

async function resolveEngagementScope(viewer?: InsightsViewer) {
  if (!viewer?.viewerUserId) {
    return {
      scope: "all" as CustomerListScope,
      engagementWhereExtra: null as Record<string, unknown> | null,
    };
  }
  const scopeResult = await resolveCustomerListScope(
    viewer.viewerUserId,
    viewer.viewerPermissions || [],
  );
  return {
    scope: scopeResult.scope,
    engagementWhereExtra: buildEngagementCreatedByScopeWhere(scopeResult),
  };
}

function mergeEngagementWhere(
  base: Record<string, unknown>,
  extra: Record<string, unknown> | null,
) {
  if (!extra) return base;
  return { ...base, ...extra };
}

const enrichEmail = (row: any) => ({
  ...row,
  category: classifyEmail(row),
  deliveryStatus: emailDeliveryLabel(row.status),
});

const buildTimelineEvents = (
  relatedAccounts: any[],
  sales: any[],
  emailsEnriched: any[],
  activities: any[],
  engagements: any[]
) => {
  const timeline: Array<{
    type: string;
    at: string;
    title: string;
    detail?: string;
    meta?: Record<string, unknown>;
  }> = [];

  relatedAccounts.forEach((plain) => {
    timeline.push({
      type: "account",
      at: plain.createdAt,
      title: "Portal account created",
      detail: plain.brand?.name || `Brand #${plain.brandId}`,
      meta: { accountId: plain.id, brandId: plain.brandId },
    });
  });

  sales.forEach((plain) => {
    timeline.push({
      type: "order",
      at: plain.conversionDate || plain.createdAt,
      title: `Sale #${plain.id}`,
      detail: plain.status,
      meta: { saleId: plain.id, price: plain.price },
    });
  });

  emailsEnriched.forEach((e) => {
    timeline.push({
      type: "email",
      at: e.sentAt,
      title: e.subject || "(no subject)",
      detail: e.deliveryStatus || e.status || "unknown",
      meta: { category: e.category, to: e.to, serviceName: e.serviceName },
    });
  });

  activities.forEach((plain) => {
    timeline.push({
      type: "activity",
      at: plain.createdAt,
      title: plain.action || "Activity",
      detail: plain.details,
      meta: {
        leadId: plain.entityId,
        userId: plain.performedBy,
        performedByUser: plain.performedByUser,
      },
    });
  });

  engagements.forEach((plain) => {
    timeline.push({
      type: "engagement",
      at: plain.createdAt,
      title: plain.title,
      detail: `${plain.type} · ${plain.status}`,
      meta: { engagementId: plain.id, type: plain.type },
    });
  });

  timeline.sort((a, b) => {
    const ta = a.at ? new Date(a.at).getTime() : 0;
    const tb = b.at ? new Date(b.at).getTime() : 0;
    return tb - ta;
  });

  return timeline;
};

export const getCustomerAccountInsights = async (
  accountId: number,
  query: InsightsQuery = {},
  viewer?: InsightsViewer,
) => {
  const emailsPage = Math.max(1, query.emailsPage || 1);
  const emailsLimit = Math.min(50, Math.max(5, query.emailsLimit || 30));
  const engagementsPage = Math.max(1, query.engagementsPage || 1);
  const engagementsLimit = Math.min(50, Math.max(5, query.engagementsLimit || 30));
  const timelinePage = Math.max(1, query.timelinePage || 1);
  const timelineLimit = Math.min(50, Math.max(5, query.timelineLimit || 30));
  const activitiesPage = Math.max(1, query.activitiesPage || 1);
  const activitiesLimit = Math.min(50, Math.max(5, query.activitiesLimit || 30));

  const { scope: engagementScope, engagementWhereExtra } =
    await resolveEngagementScope(viewer);
  const engagementWhere = mergeEngagementWhere(
    { customerAccountId: accountId },
    engagementWhereExtra,
  );

  const account = await fetchCustomerAccountById(accountId);
  const portalCustomerId = account.portalCustomerId;
  const email = (account as any).portalCustomer?.email?.trim();

  const relatedAccounts = await CustomerAccount.findAll({
    where: { portalCustomerId },
    order: [["createdAt", "DESC"]],
    include: accountIncludes,
  });
  const relatedPlain = mapPortalCustomerAsUser(
    relatedAccounts.map(
      (a) => a.get({ plain: true }) as unknown as Record<string, unknown>
    )
  );

  const saleIds = [
    ...new Set(relatedPlain.map((a) => a.saleId).filter((id): id is number => id != null)),
  ];
  const leadIds = [
    ...new Set(relatedPlain.map((a) => a.leadId).filter((id): id is number => id != null)),
  ];

  const sales =
    saleIds.length > 0
      ? await ProductSale.findAll({
          where: { id: { [Op.in]: saleIds } },
          order: [["conversionDate", "DESC"]],
        })
      : [];
  const salesPlain = sales.map((s) => s.get({ plain: true }));

  const emailWhere = email
    ? { [Op.or]: [{ to: email }, { to: { [Op.like]: `%${email}%` } }] }
    : { id: -1 };

  const emailResult = await EmailLog.findAndCountAll({
    where: emailWhere,
    order: [["sentAt", "DESC"]],
    offset: (emailsPage - 1) * emailsLimit,
    limit: emailsLimit,
  });
  const emailsEnriched = emailResult.rows.map((row) =>
    enrichEmail(row.get({ plain: true }) as any)
  );

  const engagementResult = await CustomerEngagement.findAndCountAll({
    where: engagementWhere,
    order: [["createdAt", "DESC"]],
    offset: (engagementsPage - 1) * engagementsLimit,
    limit: engagementsLimit,
    include: [
      {
        model: User,
        as: "createdByUser",
        attributes: ["id", "firstname", "lastname", "email"],
        required: false,
      },
    ],
  });
  const engagementsPlain = engagementResult.rows.map((e) => e.get({ plain: true }));

  const activityWhere =
    leadIds.length > 0
      ? { entityId: { [Op.in]: leadIds }, entityType: "lead" as const }
      : { id: -1 };

  let activityResult = { rows: [] as InstanceType<typeof LeadActivity>[], count: 0 };
  try {
    activityResult = await LeadActivity.findAndCountAll({
      where: activityWhere,
      order: [["createdAt", "DESC"]],
      offset: (activitiesPage - 1) * activitiesLimit,
      limit: activitiesLimit,
      include: [
        {
          model: User,
          as: "performedByUser",
          attributes: ["id", "firstname", "lastname", "email"],
          required: false,
        },
      ],
    });
  } catch {
    activityResult = await LeadActivity.findAndCountAll({
      where: activityWhere,
      order: [["createdAt", "DESC"]],
      offset: (activitiesPage - 1) * activitiesLimit,
      limit: activitiesLimit,
    });
  }
  const activitiesPlain = activityResult.rows.map((a) => a.get({ plain: true }));

  const notesByLead: Record<number, unknown[]> = {};
  for (const lid of leadIds) {
    try {
      const notes = await getNotesForEntity({ notebleId: lid, notebleType: "lead" });
      notesByLead[lid] = notes.map((n) => {
        const plain = n.get({ plain: true }) as any;
        if (plain.creator && !plain.User) plain.User = plain.creator;
        return plain;
      });
    } catch {
      notesByLead[lid] = [];
    }
  }

  const emailTotal = emailResult.count;
  const engagementTotal = engagementResult.count;
  const activityTotal = activityResult.count;

  const timelineFetchCap = Math.min(500, timelinePage * timelineLimit * 3);
  const [emailsForTimeline, activitiesForTimeline, engagementsForTimeline] =
    await Promise.all([
      EmailLog.findAll({
        where: emailWhere,
        order: [["sentAt", "DESC"]],
        limit: timelineFetchCap,
      }),
      leadIds.length > 0
        ? LeadActivity.findAll({
            where: { entityId: { [Op.in]: leadIds }, entityType: "lead" },
            order: [["createdAt", "DESC"]],
            limit: timelineFetchCap,
            include: [
              {
                model: User,
                as: "performedByUser",
                attributes: ["id", "firstname", "lastname", "email"],
                required: false,
              },
            ],
          })
        : Promise.resolve([]),
      CustomerEngagement.findAll({
        where: engagementWhere,
        order: [["createdAt", "DESC"]],
        limit: timelineFetchCap,
      }),
    ]);

  const emailsTimeline = emailsForTimeline.map((r) =>
    enrichEmail(r.get({ plain: true }) as any)
  );
  const activitiesTimeline = activitiesForTimeline.map((a) => a.get({ plain: true }));
  const engagementsTimeline = engagementsForTimeline.map((e) => e.get({ plain: true }));

  const fullTimeline = buildTimelineEvents(
    relatedPlain,
    salesPlain,
    emailsTimeline,
    activitiesTimeline,
    engagementsTimeline
  );

  const timelineTotal =
    relatedPlain.length +
    salesPlain.length +
    emailTotal +
    activityTotal +
    engagementTotal;

  const timelineOffset = (timelinePage - 1) * timelineLimit;
  const timelinePageItems = fullTimeline.slice(
    timelineOffset,
    timelineOffset + timelineLimit
  );

  const allEmailsForSummary = await EmailLog.findAll({
    where: emailWhere,
    order: [["sentAt", "DESC"]],
    limit: 500,
    attributes: ["status", "subject", "serviceName", "body"],
  });
  const summaryEmails = allEmailsForSummary.map((r) =>
    enrichEmail(r.get({ plain: true }) as any)
  );

  const summary = {
    brandsCount: new Set(relatedPlain.map((a) => a.brandId).filter(Boolean)).size,
    accountsCount: relatedPlain.length,
    ordersCount: salesPlain.length,
    emailsCount: emailTotal,
    emailsOpened: summaryEmails.filter((e) => e.deliveryStatus === "opened").length,
    promotionalEmails: summaryEmails.filter((e) => e.category === "promotional").length,
    activitiesCount: activityTotal,
    notesCount: Object.values(notesByLead).reduce((n, arr) => n + arr.length, 0),
    engagementsCount: engagementTotal,
    upsellOffers: await CustomerEngagement.count({
      where: { ...engagementWhere, type: "upsell" },
    }),
    discountsApplied: await CustomerEngagement.count({
      where: { ...engagementWhere, type: "discount" },
    }),
    portalActivityCount: await PortalActivityEvent.count({
      where: { customerAccountId: accountId },
    }),
  };

  return {
    account: attachPortalCustomerAsUser(
      account.get({ plain: true }) as unknown as Record<string, unknown>
    ),
    relatedAccounts: relatedPlain,
    sales: salesPlain,
    emailLogs: emailsEnriched,
    emailPagination: pagingMeta(emailsPage, emailsLimit, emailTotal),
    engagements: engagementsPlain,
    engagementPagination: pagingMeta(engagementsPage, engagementsLimit, engagementTotal),
    activities: activitiesPlain,
    activityPagination: pagingMeta(activitiesPage, activitiesLimit, activityTotal),
    notesByLead,
    timeline: timelinePageItems,
    timelinePagination: pagingMeta(timelinePage, timelineLimit, timelineTotal),
    summary,
    engagementScope,
  };
};

/** Overview / infinite scroll — latest engagements only */
export const getCustomerEngagementsFeed = async (
  accountId: number,
  page = 1,
  limit = 30,
  viewer?: InsightsViewer,
) => {
  const safePage = Math.max(1, page);
  const safeLimit = Math.min(50, Math.max(5, limit));
  await fetchCustomerAccountById(accountId);

  const { scope: engagementScope, engagementWhereExtra } =
    await resolveEngagementScope(viewer);
  const engagementWhere = mergeEngagementWhere(
    { customerAccountId: accountId },
    engagementWhereExtra,
  );

  const result = await CustomerEngagement.findAndCountAll({
    where: engagementWhere,
    order: [["createdAt", "DESC"]],
    offset: (safePage - 1) * safeLimit,
    limit: safeLimit,
    include: [
      {
        model: User,
        as: "createdByUser",
        attributes: ["id", "firstname", "lastname", "email"],
        required: false,
      },
    ],
  });

  return {
    engagements: result.rows.map((e) => e.get({ plain: true })),
    pagination: pagingMeta(safePage, safeLimit, result.count),
    engagementScope,
  };
};

/** Overview / infinite scroll — merged timeline (latest first) */
export const getCustomerTimelineFeed = async (
  accountId: number,
  page = 1,
  limit = 30,
  viewer?: InsightsViewer,
) => {
  const safePage = Math.max(1, page);
  const safeLimit = Math.min(50, Math.max(5, limit));
  const account = await fetchCustomerAccountById(accountId);
  const portalCustomerId = account.portalCustomerId;
  const email = (account as any).portalCustomer?.email?.trim();

  const { engagementWhereExtra } = await resolveEngagementScope(viewer);
  const engagementWhere = mergeEngagementWhere(
    { customerAccountId: accountId },
    engagementWhereExtra,
  );

  const relatedAccounts = await CustomerAccount.findAll({
    where: { portalCustomerId },
    order: [["createdAt", "DESC"]],
    include: accountIncludes,
  });
  const relatedPlain = mapPortalCustomerAsUser(
    relatedAccounts.map(
      (a) => a.get({ plain: true }) as unknown as Record<string, unknown>
    )
  );

  const saleIds = [
    ...new Set(relatedPlain.map((a) => a.saleId).filter((id): id is number => id != null)),
  ];
  const leadIds = [
    ...new Set(relatedPlain.map((a) => a.leadId).filter((id): id is number => id != null)),
  ];

  const sales =
    saleIds.length > 0
      ? await ProductSale.findAll({
          where: { id: { [Op.in]: saleIds } },
          order: [["conversionDate", "DESC"]],
        })
      : [];
  const salesPlain = sales.map((s) => s.get({ plain: true }));

  const emailWhere = email
    ? { [Op.or]: [{ to: email }, { to: { [Op.like]: `%${email}%` } }] }
    : { id: -1 };

  const [emailTotal, activityTotal, engagementTotal] = await Promise.all([
    EmailLog.count({ where: emailWhere }),
    leadIds.length > 0
      ? LeadActivity.count({
          where: { entityId: { [Op.in]: leadIds }, entityType: "lead" },
        })
      : Promise.resolve(0),
    CustomerEngagement.count({ where: engagementWhere }),
  ]);

  const timelineTotal =
    relatedPlain.length + salesPlain.length + emailTotal + activityTotal + engagementTotal;

  const timelineFetchCap = Math.min(500, safePage * safeLimit * 3);
  const [emailsForTimeline, activitiesForTimeline, engagementsForTimeline] =
    await Promise.all([
      EmailLog.findAll({
        where: emailWhere,
        order: [["sentAt", "DESC"]],
        limit: timelineFetchCap,
      }),
      leadIds.length > 0
        ? LeadActivity.findAll({
            where: { entityId: { [Op.in]: leadIds }, entityType: "lead" },
            order: [["createdAt", "DESC"]],
            limit: timelineFetchCap,
            include: [
              {
                model: User,
                as: "performedByUser",
                attributes: ["id", "firstname", "lastname", "email"],
                required: false,
              },
            ],
          })
        : Promise.resolve([]),
      CustomerEngagement.findAll({
        where: engagementWhere,
        order: [["createdAt", "DESC"]],
        limit: timelineFetchCap,
      }),
    ]);

  const fullTimeline = buildTimelineEvents(
    relatedPlain,
    salesPlain,
    emailsForTimeline.map((r) => enrichEmail(r.get({ plain: true }) as any)),
    activitiesForTimeline.map((a) => a.get({ plain: true })),
    engagementsForTimeline.map((e) => e.get({ plain: true }))
  );

  const timelineOffset = (safePage - 1) * safeLimit;
  const timeline = fullTimeline.slice(timelineOffset, timelineOffset + safeLimit);

  return {
    timeline,
    pagination: pagingMeta(safePage, safeLimit, timelineTotal),
  };
};

export type ListScopedEngagementsQuery = {
  page?: number;
  limit?: number;
  type?: string;
  search?: string;
  brandId?: number;
  viewerUserId: number;
  viewerPermissions?: string[];
};

/** Cross-customer list of emails, upsells, discounts, notifications scoped to viewer. */
export const listScopedCustomerEngagements = async ({
  page = 1,
  limit = 30,
  type,
  search,
  brandId,
  viewerUserId,
  viewerPermissions = [],
}: ListScopedEngagementsQuery) => {
  const safePage = Math.max(1, page);
  const safeLimit = Math.min(50, Math.max(5, limit));
  const offset = (safePage - 1) * safeLimit;

  const scopeResult = await resolveCustomerListScope(
    viewerUserId,
    viewerPermissions,
  );
  const saleScope = buildCustomerAccountSaleScopeWhere(scopeResult);
  const createdByScope = buildEngagementCreatedByScopeWhere(scopeResult);

  const where: Record<string, unknown> = {
    type:
      type && ENGAGEMENT_ACTION_TYPES.includes(type as any)
        ? type
        : { [Op.in]: [...ENGAGEMENT_ACTION_TYPES] },
  };
  if (createdByScope) Object.assign(where, createdByScope);

  const accountWhere: Record<string, unknown> = {};
  if (brandId != null && Number.isFinite(brandId)) {
    accountWhere.brandId = brandId;
  }
  if (search?.trim()) {
    const q = `%${search.trim()}%`;
    where[Op.or as any] = [
      { title: { [Op.like]: q } },
      { details: { [Op.like]: q } },
    ];
  }

  const result = await CustomerEngagement.findAndCountAll({
    where,
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
            required: false,
          },
          { model: Brand, as: "brand", required: false, attributes: ["id", "name"] },
          {
            model: ProductSale,
            as: "sale",
            required: scopeResult.scope !== "all",
            where: saleScope || undefined,
            attributes: ["id", "assigneeId", "createdBy"],
          },
        ],
      },
      {
        model: User,
        as: "createdByUser",
        attributes: ["id", "firstname", "lastname", "email"],
        required: false,
      },
    ],
  });

  return {
    data: result.rows.map((row) => row.get({ plain: true })),
    scope: scopeResult.scope,
    totalItems: result.count,
    currentPage: safePage,
    pageSize: safeLimit,
    totalPages: Math.max(1, Math.ceil(result.count / safeLimit) || 1),
  };
};
