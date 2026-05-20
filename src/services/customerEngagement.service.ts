import "../models/associations";
import "../models/index";
import CustomerAccount from "../models/customerAccount.model";
import CustomerEngagement, {
  CustomerEngagementType,
} from "../models/customerEngagement.model";
import User from "../models/user.model";
import EmailLog from "../models/emailLog.model";
import { sendEmail } from "../utils/email";
import { getSmtpConfig } from "../utils/getSmtpConfig";
import { logLeadActivity } from "../utils/logLeadActivity";

const fetchAccountForEngagement = async (accountId: number) => {
  const account = await CustomerAccount.findByPk(accountId, {
    include: [{ model: User, as: "user", attributes: ["id", "email", "firstname", "lastname"] }],
  });
  if (!account) throw new Error("Customer account not found");
  const email = (account as any).user?.email?.trim();
  if (!email) throw new Error("Customer email not found");
  return { account, email };
};

export const listCustomerEngagements = async (accountId: number) => {
  return CustomerEngagement.findAll({
    where: { customerAccountId: accountId },
    order: [["createdAt", "DESC"]],
    limit: 100,
    include: [
      {
        model: User,
        as: "createdByUser",
        attributes: ["id", "firstname", "lastname", "email"],
        required: false,
      },
    ],
  });
};

export const createCustomerEngagement = async ({
  accountId,
  type,
  title,
  details,
  metadata,
  status,
  createdBy,
}: {
  accountId: number;
  type: CustomerEngagementType;
  title: string;
  details?: string;
  metadata?: Record<string, unknown>;
  status?: string;
  createdBy: number;
}) => {
  await fetchAccountForEngagement(accountId);
  const row = await CustomerEngagement.create({
    customerAccountId: accountId,
    type,
    title,
    details: details || null,
    metadata: metadata || null,
    status: (status as any) || "active",
    createdBy,
  });
  return row;
};

export const sendEmailToCustomerAccount = async ({
  accountId,
  subject,
  body,
  category = "promotional",
  createdBy,
}: {
  accountId: number;
  subject: string;
  body: string;
  category?: string;
  createdBy: number;
}) => {
  const { account, email } = await fetchAccountForEngagement(accountId);

  const smtpRaw = await getSmtpConfig(createdBy);
  const smtp = {
    host: smtpRaw.host || "",
    port: smtpRaw.port || 587,
    user: smtpRaw.user || "",
    pass: smtpRaw.pass || "",
  };
  if (!smtp.host || !smtp.user || !smtp.pass) {
    throw new Error("SMTP configuration is incomplete.");
  }

  await sendEmail({ smtp, to: email, subject, body });

  await EmailLog.create({
    to: email,
    subject,
    body,
    status: "sent",
    serviceName: `customer_${category}`,
    sentAt: new Date(),
  });

  const engagement = await CustomerEngagement.create({
    customerAccountId: accountId,
    type: "promotional_email",
    title: subject,
    details: body,
    metadata: { category, recipient: email },
    status: "sent",
    createdBy,
  });

  if (account.leadId) {
    await logLeadActivity({
      entityId: account.leadId,
      entityType: "lead",
      action: "customer_email_sent",
      performedBy: createdBy,
      details: `${subject} (${category})`,
    });
  }

  return { engagement, email };
};

export const applyCustomerDiscount = async ({
  accountId,
  discountPercent,
  discountCode,
  note,
  validUntil,
  createdBy,
}: {
  accountId: number;
  discountPercent?: number;
  discountCode?: string;
  note?: string;
  validUntil?: string;
  createdBy: number;
}) => {
  const { account } = await fetchAccountForEngagement(accountId);
  const title = discountCode
    ? `Discount code: ${discountCode}`
    : `Discount ${discountPercent ?? 0}%`;

  const engagement = await CustomerEngagement.create({
    customerAccountId: accountId,
    type: "discount",
    title,
    details: note || null,
    metadata: { discountPercent, discountCode, validUntil },
    status: "applied",
    createdBy,
  });

  if (account.leadId) {
    await logLeadActivity({
      entityId: account.leadId,
      entityType: "lead",
      action: "customer_discount_applied",
      performedBy: createdBy,
      details: title,
    });
  }

  return engagement;
};

export const createUpsellOffer = async ({
  accountId,
  productName,
  price,
  description,
  createdBy,
}: {
  accountId: number;
  productName: string;
  price?: number;
  description?: string;
  createdBy: number;
}) => {
  const { account } = await fetchAccountForEngagement(accountId);
  const title = `Upsell: ${productName}`;

  const engagement = await CustomerEngagement.create({
    customerAccountId: accountId,
    type: "upsell",
    title,
    details: description || null,
    metadata: { productName, price },
    status: "active",
    createdBy,
  });

  if (account.leadId) {
    await logLeadActivity({
      entityId: account.leadId,
      entityType: "lead",
      action: "customer_upsell_created",
      performedBy: createdBy,
      details: title,
    });
  }

  return engagement;
};

export const sendCustomerNotification = async ({
  accountId,
  message,
  sendEmailAlso,
  createdBy,
}: {
  accountId: number;
  message: string;
  sendEmailAlso?: boolean;
  createdBy: number;
}) => {
  const { account, email } = await fetchAccountForEngagement(accountId);

  const engagement = await CustomerEngagement.create({
    customerAccountId: accountId,
    type: "notification",
    title: "Customer notification",
    details: message,
    metadata: { channel: sendEmailAlso ? "email+log" : "log" },
    status: "sent",
    createdBy,
  });

  if (sendEmailAlso) {
    const smtpRaw = await getSmtpConfig(createdBy);
    await sendEmail({
      smtp: smtpRaw,
      to: email,
      subject: "Notification from your account team",
      body: `<p>${message}</p>`,
    });
    await EmailLog.create({
      to: email,
      subject: "Notification from your account team",
      body: message,
      status: "sent",
      serviceName: "customer_notification",
      sentAt: new Date(),
    });
  }

  if (account.leadId) {
    await logLeadActivity({
      entityId: account.leadId,
      entityType: "lead",
      action: "customer_notification",
      performedBy: createdBy,
      details: message.slice(0, 500),
    });
  }

  return engagement;
};
