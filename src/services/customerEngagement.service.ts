import "../models/associations";
import "../models/index";
import CustomerAccount from "../models/customerAccount.model";
import CustomerEngagement, {
  CustomerEngagementType,
} from "../models/customerEngagement.model";
import User from "../models/user.model";
import PortalCustomer from "../models/portalCustomer.model";
import EmailLog from "../models/emailLog.model";
import {
  CUSTOMER_EMAIL_TYPE_DEFAULTS,
  categoryToCustomerEmailType,
  parseCustomerEmailType,
  type CustomerEmailType,
} from "../constants/customerEmailTypes";
import { customerEngagementEmailTemplate } from "../Templetes/customerEngagementEmailTemplate";
import { sendCustomerPortalEmail } from "../utils/customerPortalEmail";
import { getCustomerEmailBrandTheme } from "../utils/customerEmailBrandTheme";
import { logLeadActivity } from "../utils/logLeadActivity";
import ProductSale from "../models/product.model";

const resolveEngagementSaleId = async (
  account: InstanceType<typeof CustomerAccount>,
  saleId?: number | null
): Promise<number | null> => {
  const target = saleId ?? account.saleId ?? null;
  if (!target) return null;

  const linkedAccount = await CustomerAccount.findOne({
    where: {
      portalCustomerId: account.portalCustomerId,
      brandId: account.brandId,
      saleId: target,
      status: "active",
    },
  });
  if (!linkedAccount) {
    throw new Error("Order is not linked to this customer");
  }
  return target;
};

const fetchAccountForEngagement = async (accountId: number) => {
  const account = await CustomerAccount.findByPk(accountId, {
    include: [
      {
        model: PortalCustomer,
        as: "portalCustomer",
        attributes: ["id", "email", "firstname", "lastname"],
      },
    ],
  });
  if (!account) throw new Error("Customer account not found");
  const portalCustomer = (account as any).portalCustomer as
    | InstanceType<typeof PortalCustomer>
    | undefined;
  const email = portalCustomer?.email?.trim();
  if (!email) throw new Error("Customer email not found");
  return { account, email, portalCustomer };
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
  emailType: emailTypeRaw,
  createdBy,
}: {
  accountId: number;
  subject: string;
  body: string;
  category?: string;
  emailType?: CustomerEmailType | string;
  createdBy: number;
}) => {
  const { account, email, portalCustomer } =
    await fetchAccountForEngagement(accountId);

  const emailType = emailTypeRaw
    ? parseCustomerEmailType(emailTypeRaw)
    : categoryToCustomerEmailType(category);

  const theme = await getCustomerEmailBrandTheme(account.brandId);
  const { subject: mailSubject, html } = customerEngagementEmailTemplate({
    firstname: portalCustomer?.firstname,
    lastname: portalCustomer?.lastname,
    subject,
    body,
    theme,
  });
  await sendCustomerPortalEmail({
    to: email,
    subject: mailSubject,
    body: html,
    theme,
    brandId: account.brandId,
    emailType,
  });

  await EmailLog.create({
    to: email,
    subject: mailSubject,
    body: html,
    status: "sent",
    serviceName: `customer_${category}`,
    sentAt: new Date(),
  });

  const engagement = await CustomerEngagement.create({
    customerAccountId: accountId,
    type: "promotional_email",
    title: mailSubject,
    details: body,
    metadata: { category, emailType, recipient: email },
    status: "sent",
    createdBy,
  });

  if (account.leadId) {
    await logLeadActivity({
      entityId: account.leadId,
      entityType: "lead",
      action: "customer_email_sent",
      performedBy: createdBy,
      details: `${mailSubject} (${category})`,
    });
  }

  return { engagement, email };
};

export const applyCustomerDiscount = async ({
  accountId,
  saleId,
  discountPercent,
  discountCode,
  note,
  validUntil,
  createdBy,
}: {
  accountId: number;
  saleId?: number | null;
  discountPercent?: number;
  discountCode?: string;
  note?: string;
  validUntil?: string;
  createdBy: number;
}) => {
  const { account } = await fetchAccountForEngagement(accountId);
  const linkedSaleId = await resolveEngagementSaleId(account, saleId);
  const title = discountCode
    ? `Discount code: ${discountCode}`
    : `Discount ${discountPercent ?? 0}%`;

  let originalPrice: number | null = null;
  let discountedPrice: number | null = null;
  let discountAmount: number | null = null;
  if (linkedSaleId && discountPercent != null && discountPercent > 0) {
    const sale = await ProductSale.findByPk(linkedSaleId, {
      attributes: ["id", "price"],
    });
    if (sale?.price != null) {
      originalPrice = Number(sale.price);
      discountAmount =
        Math.round(originalPrice * (discountPercent / 100) * 100) / 100;
      discountedPrice =
        Math.round((originalPrice - discountAmount) * 100) / 100;
    }
  }

  const engagement = await CustomerEngagement.create({
    customerAccountId: accountId,
    saleId: linkedSaleId,
    type: "discount",
    title,
    details: note || null,
    metadata: {
      discountPercent,
      discountCode,
      validUntil,
      saleId: linkedSaleId,
      originalPrice,
      discountedPrice,
      discountAmount,
    },
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
  saleId,
  productName,
  price,
  description,
  createdBy,
}: {
  accountId: number;
  saleId?: number | null;
  productName: string;
  price?: number;
  description?: string;
  createdBy: number;
}) => {
  const { account } = await fetchAccountForEngagement(accountId);
  const linkedSaleId = await resolveEngagementSaleId(account, saleId);
  const title = linkedSaleId
    ? `Upsell for order #${linkedSaleId}: ${productName}`
    : `Upsell: ${productName}`;

  let orderPrice: number | null = null;
  let combinedTotal: number | null = null;
  if (linkedSaleId) {
    const sale = await ProductSale.findByPk(linkedSaleId, {
      attributes: ["id", "price"],
    });
    if (sale?.price != null) {
      orderPrice = Number(sale.price);
      if (price != null && price > 0) {
        combinedTotal = Math.round((orderPrice + price) * 100) / 100;
      }
    }
  }

  const engagement = await CustomerEngagement.create({
    customerAccountId: accountId,
    saleId: linkedSaleId,
    type: "upsell",
    title,
    details: description || null,
    metadata: {
      productName,
      price,
      saleId: linkedSaleId,
      orderPrice,
      combinedTotal,
    },
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
  emailType: emailTypeRaw,
  createdBy,
}: {
  accountId: number;
  message: string;
  sendEmailAlso?: boolean;
  emailType?: CustomerEmailType | string;
  createdBy: number;
}) => {
  const { account, email, portalCustomer } =
    await fetchAccountForEngagement(accountId);

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
    const emailType = emailTypeRaw
      ? parseCustomerEmailType(emailTypeRaw, CUSTOMER_EMAIL_TYPE_DEFAULTS.notification)
      : CUSTOMER_EMAIL_TYPE_DEFAULTS.notification;
    const theme = await getCustomerEmailBrandTheme(account.brandId);
    const notifySubject = `Notification from ${theme.brandLabel}`;
    const { subject: mailSubject, html } = customerEngagementEmailTemplate({
      firstname: portalCustomer?.firstname,
      lastname: portalCustomer?.lastname,
      subject: notifySubject,
      body: message,
      theme,
    });
    await sendCustomerPortalEmail({
      to: email,
      subject: mailSubject,
      body: html,
      theme,
      brandId: account.brandId,
      emailType,
    });
    await EmailLog.create({
      to: email,
      subject: mailSubject,
      body: html,
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

/** Full branded HTML preview (header, logo, CTA) — inner body may include HTML/CSS. */
export const previewCustomerEngagementEmail = async (params: {
  subject?: string;
  body?: string;
  brandId?: number | null;
  firstname?: string | null;
  lastname?: string | null;
}) => {
  const theme = await getCustomerEmailBrandTheme(params.brandId);
  const subject =
    String(params.subject || "").trim() ||
    `Message from ${theme.brandLabel || "GWB"}`;
  const { html, brandName } = customerEngagementEmailTemplate({
    firstname: params.firstname ?? "Customer",
    lastname: params.lastname ?? "",
    subject,
    body: params.body || "",
    theme,
  });
  return {
    subject,
    html,
    brandName,
    brandLabel: theme.brandLabel,
  };
};
