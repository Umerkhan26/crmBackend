import { Op } from "sequelize";
import "../models/associations";
import CustomerAccount from "../models/customerAccount.model";
import PortalCustomer from "../models/portalCustomer.model";
import BulkEmailCampaign, {
  BulkEmailCampaignFilters,
  BulkEmailCampaignStatus,
} from "../models/bulkEmailCampaign.model";
import BulkEmailJob from "../models/bulkEmailJob.model";
import EmailLog from "../models/emailLog.model";
import CustomerEngagement from "../models/customerEngagement.model";
import {
  categoryToCustomerEmailType,
  parseCustomerEmailType,
  type CustomerEmailType,
} from "../constants/customerEmailTypes";
import { customerEngagementEmailTemplate } from "../Templetes/customerEngagementEmailTemplate";
import {
  getCustomerPortalSmtpAuditSnapshot,
  sendCustomerPortalEmail,
} from "../utils/customerPortalEmail";
import { getCustomerEmailBrandTheme } from "../utils/customerEmailBrandTheme";
import { fillTemplate } from "../utils/fillTemplate";
import { logLeadActivity } from "../utils/logLeadActivity";

const JOB_CHUNK_SIZE = 500;
const MAX_ATTEMPTS = 3;
const runningCampaigns = new Set<number>();

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const getBulkEmailDelayMs = (): number => {
  const raw = Number(process.env.BULK_EMAIL_DELAY_MS || "1500");
  return Number.isFinite(raw) && raw >= 0 ? raw : 1500;
};

const buildRecipientWhere = (filters?: BulkEmailCampaignFilters) => {
  const accountWhere: Record<string, unknown> = {};
  if (filters?.status) {
    accountWhere.status = filters.status;
  } else {
    accountWhere.status = "active";
  }
  if (filters?.brandId != null) {
    accountWhere.brandId = filters.brandId;
  }
  const ids = (filters?.customerAccountIds || []).filter((id) =>
    Number.isFinite(Number(id))
  );
  if (ids.length) {
    accountWhere.id = { [Op.in]: ids.map((id) => Number(id)) };
  }
  return accountWhere;
};

export const createBulkCustomerEmailCampaign = async ({
  subject,
  body,
  category = "promotional",
  emailType: emailTypeRaw,
  filters,
  createdBy,
}: {
  subject: string;
  body: string;
  category?: string;
  emailType?: CustomerEmailType | string;
  filters?: BulkEmailCampaignFilters;
  createdBy: number;
}) => {
  const emailType = emailTypeRaw
    ? parseCustomerEmailType(emailTypeRaw)
    : categoryToCustomerEmailType(category);
  const smtp = await getCustomerPortalSmtpAuditSnapshot({
    brandId: filters?.brandId,
    emailType,
  });

  const accounts = await CustomerAccount.findAll({
    where: buildRecipientWhere(filters),
    include: [
      {
        model: PortalCustomer,
        as: "portalCustomer",
        attributes: ["id", "email", "firstname", "lastname"],
        required: true,
      },
    ],
  });

  const seenEmails = new Set<string>();
  const recipients: {
    customerAccountId: number;
    toEmail: string;
    recipientFirstname: string | null;
    recipientLastname: string | null;
    leadId: number | null;
  }[] = [];

  for (const account of accounts) {
    const portalCustomer = (account as any).portalCustomer as
      | InstanceType<typeof PortalCustomer>
      | undefined;
    const email = portalCustomer?.email?.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue;
    if (seenEmails.has(email)) continue;
    seenEmails.add(email);
    recipients.push({
      customerAccountId: account.id,
      toEmail: email,
      recipientFirstname: portalCustomer?.firstname?.trim() || null,
      recipientLastname: portalCustomer?.lastname?.trim() || null,
      leadId: account.leadId ?? null,
    });
  }

  if (!recipients.length) {
    throw new Error("No customers with valid email addresses found for this campaign.");
  }

  const campaign = await BulkEmailCampaign.create({
    subject: subject.trim(),
    body: body.trim(),
    category: category.trim() || "promotional",
    emailType,
    filters: filters || null,
    status: "queued",
    totalRecipients: recipients.length,
    sentCount: 0,
    failedCount: 0,
    smtpConfig: smtp,
    createdBy,
  });

  for (let i = 0; i < recipients.length; i += JOB_CHUNK_SIZE) {
    const chunk = recipients.slice(i, i + JOB_CHUNK_SIZE);
    await BulkEmailJob.bulkCreate(
      chunk.map((r) => ({
        campaignId: campaign.id,
        customerAccountId: r.customerAccountId,
        toEmail: r.toEmail,
        recipientFirstname: r.recipientFirstname,
        recipientLastname: r.recipientLastname,
        status: "pending" as const,
        attempts: 0,
      }))
    );
  }

  await campaign.update({ status: "processing", startedAt: new Date() });

  return {
    campaignId: campaign.id,
    totalQueued: recipients.length,
    status: campaign.status,
  };
};

const claimNextPendingJob = async (
  campaignId: number
): Promise<BulkEmailJob | null> => {
  const job = await BulkEmailJob.findOne({
    where: { campaignId, status: "pending" },
    order: [["id", "ASC"]],
  });
  if (!job) return null;

  const [updated] = await BulkEmailJob.update(
    { status: "processing" },
    { where: { id: job.id, status: "pending" } }
  );
  if (!updated) return claimNextPendingJob(campaignId);
  return job.reload();
};

const processOneJob = async (
  campaign: BulkEmailCampaign,
  job: BulkEmailJob
) => {
  const templateData = {
    firstname: job.recipientFirstname || "",
    lastname: job.recipientLastname || "",
    email: job.toEmail,
  };
  const subject = fillTemplate(campaign.subject, templateData);
  const bodyPlain = fillTemplate(campaign.body, templateData);
  const account = await CustomerAccount.findByPk(job.customerAccountId, {
    attributes: ["brandId", "leadId"],
  });
  const theme = await getCustomerEmailBrandTheme(account?.brandId);
  const { subject: mailSubject, html } = customerEngagementEmailTemplate({
    firstname: job.recipientFirstname,
    lastname: job.recipientLastname,
    subject,
    body: bodyPlain,
    theme,
  });
  await sendCustomerPortalEmail({
    to: job.toEmail,
    subject: mailSubject,
    body: html,
    theme,
    brandId: account?.brandId,
    emailType: (campaign.emailType as CustomerEmailType) || categoryToCustomerEmailType(campaign.category),
  });

  await EmailLog.create({
    to: job.toEmail,
    subject: mailSubject,
    body: html,
    status: "sent",
    serviceName: `customer_bulk_${campaign.category}`,
    sentAt: new Date(),
  });

  await CustomerEngagement.create({
    customerAccountId: job.customerAccountId,
    type: "promotional_email",
    title: mailSubject,
    details: bodyPlain,
    metadata: {
      category: campaign.category,
      recipient: job.toEmail,
      bulkCampaignId: campaign.id,
    },
    status: "sent",
    createdBy: campaign.createdBy,
  });

  if (account?.leadId) {
    await logLeadActivity({
      entityId: account.leadId,
      entityType: "lead",
      action: "customer_bulk_email_sent",
      performedBy: campaign.createdBy,
      details: `${mailSubject} (${campaign.category})`,
    });
  }

  await job.update({
    status: "sent",
    sentAt: new Date(),
    lastError: null,
  });

  await campaign.increment("sentCount");
};

const failJob = async (
  campaign: BulkEmailCampaign,
  job: BulkEmailJob,
  errorMsg: string,
  final: boolean
) => {
  await job.update({
    status: final ? "failed" : "pending",
    lastError: errorMsg.slice(0, 2000),
    attempts: job.attempts + 1,
  });
  if (final) {
    await campaign.increment("failedCount");
    await EmailLog.create({
      to: job.toEmail,
      subject: campaign.subject,
      body: campaign.body,
      status: "failed",
      serviceName: `customer_bulk_${campaign.category}`,
      errorMsg: errorMsg.slice(0, 2000),
      sentAt: new Date(),
    });
  }
};

const finalizeCampaignIfDone = async (campaignId: number) => {
  const pending = await BulkEmailJob.count({
    where: {
      campaignId,
      status: { [Op.in]: ["pending", "processing"] },
    },
  });
  if (pending > 0) return;

  const campaign = await BulkEmailCampaign.findByPk(campaignId);
  if (!campaign || campaign.status === "cancelled") return;

  const failed = await BulkEmailJob.count({
    where: { campaignId, status: "failed" },
  });

  await campaign.update({
    status: failed > 0 && campaign.sentCount === 0 ? "failed" : "completed",
    completedAt: new Date(),
  });
};

export const runBulkCustomerEmailCampaign = async (campaignId: number) => {
  if (runningCampaigns.has(campaignId)) return;
  runningCampaigns.add(campaignId);

  try {
    const delayMs = getBulkEmailDelayMs();

    while (true) {
      const campaign = await BulkEmailCampaign.findByPk(campaignId);
      if (!campaign) break;
      if (campaign.status === "cancelled") break;

      const job = await claimNextPendingJob(campaignId);
      if (!job) {
        await finalizeCampaignIfDone(campaignId);
        break;
      }

      try {
        await processOneJob(campaign, job);
      } catch (err: any) {
        const msg = err?.message || String(err);
        const nextAttempts = job.attempts + 1;
        const final = nextAttempts >= MAX_ATTEMPTS;
        await failJob(campaign, job, msg, final);
      }

      if (delayMs > 0) {
        await delay(delayMs);
      }
    }
  } finally {
    runningCampaigns.delete(campaignId);
  }
};

export const scheduleBulkCustomerEmailCampaign = (campaignId: number) => {
  setImmediate(() => {
    runBulkCustomerEmailCampaign(campaignId).catch((err) => {
      console.error(`bulk email campaign ${campaignId} worker error:`, err);
    });
  });
};

export const resumeStaleBulkEmailCampaigns = async () => {
  const stale = await BulkEmailCampaign.findAll({
    where: { status: { [Op.in]: ["queued", "processing"] } },
    attributes: ["id"],
  });
  for (const row of stale) {
    scheduleBulkCustomerEmailCampaign(row.id);
  }
};

export const listBulkCustomerEmailCampaigns = async ({
  page = 1,
  limit = 20,
}: {
  page?: number;
  limit?: number;
} = {}) => {
  const safePage = Math.max(1, page);
  const safeLimit = Math.min(50, Math.max(5, limit));
  const offset = (safePage - 1) * safeLimit;

  const { rows, count } = await BulkEmailCampaign.findAndCountAll({
    order: [["createdAt", "DESC"]],
    limit: safeLimit,
    offset,
    attributes: [
      "id",
      "subject",
      "category",
      "status",
      "totalRecipients",
      "sentCount",
      "failedCount",
      "filters",
      "createdBy",
      "startedAt",
      "completedAt",
      "createdAt",
    ],
  });

  const items = await Promise.all(
    rows.map(async (row) => {
      const plain = row.toJSON();
      const pendingCount = await BulkEmailJob.count({
        where: {
          campaignId: row.id,
          status: { [Op.in]: ["pending", "processing"] },
        },
      });
      return { ...plain, pendingCount };
    })
  );

  return {
    items,
    total: count,
    page: safePage,
    limit: safeLimit,
    totalPages: Math.ceil(count / safeLimit) || 1,
  };
};

export const getBulkCustomerEmailCampaignStatus = async (campaignId: number) => {
  const campaign = await BulkEmailCampaign.findByPk(campaignId, {
    attributes: [
      "id",
      "subject",
      "category",
      "status",
      "totalRecipients",
      "sentCount",
      "failedCount",
      "filters",
      "createdBy",
      "startedAt",
      "completedAt",
      "createdAt",
    ],
  });
  if (!campaign) throw new Error("Bulk email campaign not found");

  const pendingCount = await BulkEmailJob.count({
    where: { campaignId, status: { [Op.in]: ["pending", "processing"] } },
  });

  return {
    ...campaign.toJSON(),
    pendingCount,
  };
};

export const cancelBulkCustomerEmailCampaign = async (campaignId: number) => {
  const campaign = await BulkEmailCampaign.findByPk(campaignId);
  if (!campaign) throw new Error("Bulk email campaign not found");
  if (["completed", "cancelled"].includes(campaign.status)) {
    throw new Error(`Campaign is already ${campaign.status}`);
  }

  await BulkEmailJob.update(
    { status: "cancelled" },
    { where: { campaignId, status: { [Op.in]: ["pending", "processing"] } } }
  );

  await campaign.update({
    status: "cancelled",
    completedAt: new Date(),
  });

  return getBulkCustomerEmailCampaignStatus(campaignId);
};

export const listBulkCustomerEmailCampaignFailures = async (
  campaignId: number,
  page = 1,
  limit = 20
) => {
  const offset = (page - 1) * limit;
  const { rows, count } = await BulkEmailJob.findAndCountAll({
    where: { campaignId, status: "failed" },
    order: [["id", "ASC"]],
    limit,
    offset,
    attributes: [
      "id",
      "toEmail",
      "customerAccountId",
      "lastError",
      "attempts",
      "updatedAt",
    ],
  });
  return {
    items: rows,
    total: count,
    page,
    limit,
    totalPages: Math.ceil(count / limit) || 1,
  };
};
