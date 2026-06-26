import { customerBrandedEmailTemplate } from "../Templetes/customerBrandedEmailTemplate";
import {
  getCustomerPortalSmtpConfig,
  type SmtpCredentials,
} from "./getCustomerPortalSmtpConfig";
import {
  type CustomerEmailBrandTheme,
  buildCustomerEmailBrandTheme,
} from "./customerEmailBrandTheme";
import {
  applyCustomerEmailHeaderDelivery,
  getCustomerEmailHeaderDelivery,
} from "./customerEmailAssetFiles";

/** Sender display name + sign-off for all customer-facing emails (all brands). */
export const CUSTOMER_EMAIL_BRAND_NAME =
  process.env.CUSTOMER_PORTAL_EMAIL_BRAND_NAME?.trim() || "GWB";

export const getCustomerPortalSmtpForSend = (fromName?: string): SmtpCredentials => {
  const cfg = getCustomerPortalSmtpConfig();
  return {
    ...cfg,
    fromName: fromName?.trim() || CUSTOMER_EMAIL_BRAND_NAME,
  };
};

/** Customer-facing mail — GWB SMTP, brand-wise sender display name. */
export const sendCustomerPortalEmail = async (params: {
  to: string;
  subject: string;
  body: string;
  fromName?: string;
  theme?: CustomerEmailBrandTheme;
}): Promise<void> => {
  const { sendEmail } = await import("./email");
  const senderName =
    params.fromName?.trim() ||
    params.theme?.brandLabel?.trim() ||
    CUSTOMER_EMAIL_BRAND_NAME;
  const smtp = getCustomerPortalSmtpForSend(senderName);
  const replyTo =
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
export const getCustomerPortalSmtpAuditSnapshot = () => {
  const smtp = getCustomerPortalSmtpForSend();
  return {
    host: smtp.host,
    port: smtp.port,
    user: smtp.user,
    fromName: smtp.fromName,
  };
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
