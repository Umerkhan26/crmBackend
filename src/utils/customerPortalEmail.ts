import { customerBrandedEmailTemplate } from "../Templetes/customerBrandedEmailTemplate";
import type { SmtpCredentials } from "./getCustomerPortalSmtpConfig";
import {
  type CustomerEmailBrandTheme,
  buildCustomerEmailBrandTheme,
} from "./customerEmailBrandTheme";
import {
  applyCustomerEmailHeaderDelivery,
  getCustomerEmailHeaderDelivery,
} from "./customerEmailAssetFiles";
import {
  type CustomerEmailType,
  CUSTOMER_EMAIL_TYPE_DEFAULTS,
} from "../constants/customerEmailTypes";
import {
  getCustomerSenderAuditSnapshot,
  resolveCustomerSender,
} from "./resolveCustomerSender";

/** Sender display name + sign-off for all customer-facing emails (all brands). */
export const CUSTOMER_EMAIL_BRAND_NAME =
  process.env.CUSTOMER_PORTAL_EMAIL_BRAND_NAME?.trim() || "GWB";

/** @deprecated Use resolveCustomerSender — kept for callers not yet migrated */
export const getCustomerPortalSmtpForSend = (fromName?: string): SmtpCredentials => {
  const host =
    process.env.CUSTOMER_PORTAL_SMTP_HOST?.trim() || "globalwebbuilders.com";
  const port = Number(process.env.CUSTOMER_PORTAL_SMTP_PORT || "465");
  const user =
    process.env.CUSTOMER_PORTAL_SMTP_EMAIL?.trim() ||
    "support@globalwebbuilders.com";
  const pass = process.env.CUSTOMER_PORTAL_SMTP_PASSWORD?.trim() || "";
  return {
    host,
    port: Number.isFinite(port) && port > 0 ? port : 465,
    user,
    pass,
    fromName: fromName?.trim() || CUSTOMER_EMAIL_BRAND_NAME,
  };
};

/** Customer-facing mail — brand + type resolves SMTP (care / invoice / promotions). */
export const sendCustomerPortalEmail = async (params: {
  to: string;
  subject: string;
  body: string;
  fromName?: string;
  theme?: CustomerEmailBrandTheme;
  brandId?: number | null;
  emailType?: CustomerEmailType;
}): Promise<void> => {
  const { sendEmail } = await import("./email");
  const emailType = params.emailType || CUSTOMER_EMAIL_TYPE_DEFAULTS.promotional;
  const senderName =
    params.fromName?.trim() ||
    params.theme?.brandLabel?.trim() ||
    CUSTOMER_EMAIL_BRAND_NAME;

  const resolved = await resolveCustomerSender({
    brandId: params.brandId,
    emailType,
    fromNameOverride: senderName,
  });

  const smtp: SmtpCredentials = {
    host: resolved.host,
    port: resolved.port,
    user: resolved.user,
    pass: resolved.pass,
    fromName: resolved.fromName,
  };

  const replyTo =
    resolved.replyTo?.trim() ||
    params.theme?.supportEmail?.trim() ||
    process.env.CUSTOMER_PORTAL_REPLY_TO?.trim() ||
    smtp.user;

  let body = params.body;
  let attachments:
    | Array<{ filename: string; path: string; cid: string }>
    | undefined;

  if (params.theme) {
    const delivery = getCustomerEmailHeaderDelivery(params.theme);
    if (delivery?.attachment) {
      body = applyCustomerEmailHeaderDelivery(body, params.theme, delivery);
      attachments = [delivery.attachment];
    }
  }

  await sendEmail({
    smtp,
    replyTo,
    to: params.to,
    subject: params.subject,
    body,
    attachments,
    strict: true,
  });
};

/** Audit snapshot for DB — never store SMTP password. */
export const getCustomerPortalSmtpAuditSnapshot = async (params?: {
  brandId?: number | null;
  emailType?: CustomerEmailType;
}) => {
  return getCustomerSenderAuditSnapshot({
    brandId: params?.brandId,
    emailType: params?.emailType || CUSTOMER_EMAIL_TYPE_DEFAULTS.promotional,
  });
};

const escapeHtml = (raw: string) =>
  raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const bodyToHtml = (body: string): string => {
  const trimmed = String(body || "").trim();
  if (!trimmed) return "<p style=\"margin:0;\">&nbsp;</p>";
  if (/<[a-z][\s\S]*>/i.test(trimmed)) return trimmed;
  return trimmed
    .split(/\n{2,}/)
    .map(
      (para) =>
        `<p style="margin:0 0 12px 0;">${escapeHtml(para).replace(/\n/g, "<br/>")}</p>`
    )
    .join("");
};

export const buildCustomerPortalEmailHtml = (params: {
  firstname?: string | null;
  lastname?: string | null;
  subject: string;
  body: string;
  theme?: CustomerEmailBrandTheme;
}): string => {
  const theme = params.theme || buildCustomerEmailBrandTheme("gwb");
  const name = [params.firstname, params.lastname]
    .map((s) => String(s || "").trim())
    .filter(Boolean)
    .join(" ");
  const greeting = name ? `Hello ${name},` : "Hello,";
  const bodyHtml = bodyToHtml(params.body);

  const contentHtml = `<div>${bodyHtml}</div>`;

  return customerBrandedEmailTemplate({
    theme,
    title: params.subject,
    preheader: params.subject,
    greeting,
    contentHtml,
    cta: {
      label: "Open customer portal",
      url: theme.portalUrl,
    },
  });
};
