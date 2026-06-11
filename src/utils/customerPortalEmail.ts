import { baseEmailTemplate } from "../Templetes/baseEmailTemplate";
import {
  getCustomerPortalSmtpConfig,
  type SmtpCredentials,
} from "./getCustomerPortalSmtpConfig";

/** Sender display name + sign-off for all customer-facing emails (all brands). */
export const CUSTOMER_EMAIL_BRAND_NAME =
  process.env.CUSTOMER_PORTAL_EMAIL_BRAND_NAME?.trim() || "GWB";

export const getCustomerPortalSmtpForSend = (): SmtpCredentials => {
  const cfg = getCustomerPortalSmtpConfig();
  return {
    ...cfg,
    fromName: CUSTOMER_EMAIL_BRAND_NAME,
  };
};

/** Customer-facing mail — always GWB SMTP, never DEFAULT_SMTP fallback. */
export const sendCustomerPortalEmail = async (params: {
  to: string;
  subject: string;
  body: string;
}): Promise<void> => {
  const { sendEmail } = await import("./email");
  const smtp = getCustomerPortalSmtpForSend();
  await sendEmail({
    smtp,
    to: params.to,
    subject: params.subject,
    body: params.body,
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
}): string => {
  const name = [params.firstname, params.lastname]
    .map((s) => String(s || "").trim())
    .filter(Boolean)
    .join(" ");
  const greeting = name ? `Hello ${name},` : "Hello,";
  const brand = CUSTOMER_EMAIL_BRAND_NAME;
  const bodyHtml = bodyToHtml(params.body);

  const content = `
    <p style="margin:0 0 14px 0; text-align:center; font-size:16px; color:#5664d2; font-weight:600;">${escapeHtml(greeting)}</p>
    <div style="color:#212529;">${bodyHtml}</div>
    <p style="margin:20px 0 0 0; text-align:center; color:#5664d2; line-height:1.5;">
      <strong>Best regards,</strong><br/>${escapeHtml(brand)} Team
    </p>
  `;

  return baseEmailTemplate({
    title: params.subject,
    content,
    primaryColor: "#5664d2",
    accentColor: "#764ba2",
    footerText: `© ${new Date().getFullYear()} ${brand}. All rights reserved.`,
    replyNotice: `This is an automated email from ${brand}. Please do not reply.`,
  });
};
