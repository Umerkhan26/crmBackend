/**
 * SMTP for customer portal emails (credentials, promos, bulk to customers).
 * Configure in .env — does not use agent/default CRM SMTP.
 *
 * CUSTOMER_PORTAL_SMTP_HOST=globalwebbuilders.com
 * CUSTOMER_PORTAL_SMTP_PORT=465
 * CUSTOMER_PORTAL_SMTP_EMAIL=support@globalwebbuilders.com
 * CUSTOMER_PORTAL_SMTP_PASSWORD=...
 * CUSTOMER_PORTAL_EMAIL_BRAND_NAME=GWB
 */
export type SmtpCredentials = {
  host: string;
  port: number;
  user: string;
  pass: string;
  fromName?: string;
};

export const isCustomerPortalSmtpConfigured = (): boolean => {
  const pass = process.env.CUSTOMER_PORTAL_SMTP_PASSWORD?.trim();
  const user =
    process.env.CUSTOMER_PORTAL_SMTP_EMAIL?.trim() ||
    "support@globalwebbuilders.com";
  const host =
    process.env.CUSTOMER_PORTAL_SMTP_HOST?.trim() || "globalwebbuilders.com";
  return !!(host && user && pass);
};

export const getCustomerPortalSmtpConfig = (): SmtpCredentials => {
  const host =
    process.env.CUSTOMER_PORTAL_SMTP_HOST?.trim() || "globalwebbuilders.com";
  const port = Number(process.env.CUSTOMER_PORTAL_SMTP_PORT || "465");
  const user =
    process.env.CUSTOMER_PORTAL_SMTP_EMAIL?.trim() ||
    "support@globalwebbuilders.com";
  const pass = process.env.CUSTOMER_PORTAL_SMTP_PASSWORD?.trim() || "";
  const fromName =
    process.env.CUSTOMER_PORTAL_EMAIL_BRAND_NAME?.trim() ||
    process.env.CUSTOMER_PORTAL_SMTP_FROM_NAME?.trim() ||
    "GWB";

  if (!pass) {
    throw new Error(
      "Customer portal SMTP is not configured. Set CUSTOMER_PORTAL_SMTP_PASSWORD in .env"
    );
  }

  return {
    host,
    port: Number.isFinite(port) && port > 0 ? port : 465,
    user,
    pass,
    fromName,
  };
};
