import "../models/associations";
import "../models/index";
import { Op } from "sequelize";
import CustomerAccount from "../models/customerAccount.model";
import User from "../models/user.model";
import Brand from "../models/brand.model";
import Lead from "../models/lead.model";
import ProductSale from "../models/product.model";
import EmailLog from "../models/emailLog.model";
import LeadActivity from "../models/leadActivity.model";
import { getNotesForEntity } from "./note.service";
import { listCustomerEngagements } from "./customerEngagement.service";

const accountIncludes = [
  {
    model: User,
    as: "user",
    attributes: ["id", "firstname", "lastname", "email", "status", "userrole"],
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

export const getCustomerAccountInsights = async (accountId: number) => {
  const account = await fetchCustomerAccountById(accountId);
  const userId = account.userId;
  const email = (account as any).user?.email?.trim();

  const relatedAccounts = await CustomerAccount.findAll({
    where: { userId },
    order: [["createdAt", "DESC"]],
    include: accountIncludes,
  });

  const saleIds = [
    ...new Set(
      relatedAccounts.map((a) => a.saleId).filter((id): id is number => id != null),
    ),
  ];
  const leadIds = [
    ...new Set(
      relatedAccounts.map((a) => a.leadId).filter((id): id is number => id != null),
    ),
  ];

  const sales =
    saleIds.length > 0
      ? await ProductSale.findAll({
          where: { id: { [Op.in]: saleIds } },
          order: [["conversionDate", "DESC"]],
        })
      : [];

  const emailLogs = email
    ? await EmailLog.findAll({
        where: {
          [Op.or]: [
            { to: email },
            { to: { [Op.like]: `%${email}%` } },
          ],
        },
        order: [["sentAt", "DESC"]],
        limit: 150,
      })
      : [];

  let activities: InstanceType<typeof LeadActivity>[] = [];
  if (leadIds.length > 0) {
    const activityQuery = {
      where: { entityId: { [Op.in]: leadIds }, entityType: "lead" as const },
      order: [["createdAt", "DESC"]] as [string, string][],
      limit: 150,
    };
    try {
      activities = await LeadActivity.findAll({
        ...activityQuery,
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
      activities = await LeadActivity.findAll(activityQuery);
    }
  }

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

  const emailsEnriched = emailLogs.map((row) => {
    const plain = row.get({ plain: true }) as any;
    return {
      ...plain,
      category: classifyEmail(plain),
      deliveryStatus: emailDeliveryLabel(plain.status),
    };
  });

  const timeline: Array<{
    type: string;
    at: string;
    title: string;
    detail?: string;
    meta?: Record<string, unknown>;
  }> = [];

  relatedAccounts.forEach((acc) => {
    const plain = acc.get({ plain: true }) as any;
    timeline.push({
      type: "account",
      at: plain.createdAt,
      title: "Portal account created",
      detail: plain.brand?.name || `Brand #${plain.brandId}`,
      meta: { accountId: plain.id, brandId: plain.brandId },
    });
  });

  sales.forEach((sale) => {
    const plain = sale.get({ plain: true }) as any;
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
      detail: `Delivery: ${e.deliveryStatus || e.status || "unknown"}`,
      meta: {
        category: e.category,
        to: e.to,
        serviceName: e.serviceName,
      },
    });
  });

  activities.forEach((act) => {
    const plain = act.get({ plain: true }) as any;
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

  const engagements = await listCustomerEngagements(accountId);
  engagements.forEach((eng) => {
    const plain = eng.get({ plain: true }) as any;
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

  const summary = {
    brandsCount: new Set(relatedAccounts.map((a) => a.brandId).filter(Boolean)).size,
    accountsCount: relatedAccounts.length,
    ordersCount: sales.length,
    emailsCount: emailsEnriched.length,
    emailsOpened: emailsEnriched.filter((e) => e.deliveryStatus === "opened").length,
    promotionalEmails: emailsEnriched.filter((e) => e.category === "promotional").length,
    activitiesCount: activities.length,
    notesCount: Object.values(notesByLead).reduce((n, arr) => n + arr.length, 0),
    engagementsCount: engagements.length,
    upsellOffers: engagements.filter((e) => e.type === "upsell").length,
    discountsApplied: engagements.filter((e) => e.type === "discount").length,
  };

  return {
    account: account.get({ plain: true }),
    relatedAccounts: relatedAccounts.map((a) => a.get({ plain: true })),
    sales: sales.map((s) => s.get({ plain: true })),
    emailLogs: emailsEnriched,
    activities: activities.map((a) => a.get({ plain: true })),
    engagements: engagements.map((e) => e.get({ plain: true })),
    notesByLead,
    timeline: timeline.slice(0, 200),
    summary,
  };
};
