import BrandEmailSender from "../models/brandEmailSender.model";
import {
  type CustomerEmailType,
  CUSTOMER_EMAIL_TYPE_LABELS,
} from "../constants/customerEmailTypes";
import { decryptSmtpPassword } from "./smtpSecret";
import type { SmtpCredentials } from "./getCustomerPortalSmtpConfig";

export type ResolvedCustomerSender = SmtpCredentials & {
  emailType: CustomerEmailType;
  brandId: number | null;
  source: "brand" | "env" | "legacy";
  replyTo?: string;
};

const envKey = (emailType: CustomerEmailType, field: string): string =>
  `CUSTOMER_EMAIL_${emailType.toUpperCase()}_${field}`;

const readEnvSender = (
  emailType: CustomerEmailType
): Omit<ResolvedCustomerSender, "brandId"> | null => {
  const host = process.env[envKey(emailType, "HOST")]?.trim();
  const user = process.env[envKey(emailType, "USER")]?.trim();
  const pass = process.env[envKey(emailType, "PASSWORD")]?.trim();
  if (!host || !user || !pass) return null;

  const port = Number(process.env[envKey(emailType, "PORT")] || "465");
  const fromName =
    process.env[envKey(emailType, "FROM_NAME")]?.trim() ||
    CUSTOMER_EMAIL_TYPE_LABELS[emailType];
  const replyTo = process.env[envKey(emailType, "REPLY_TO")]?.trim() || user;

  return {
    emailType,
    source: "env",
    host,
    port: Number.isFinite(port) && port > 0 ? port : 465,
    user,
    pass,
    fromName,
    replyTo,
  };
};

const readLegacyPortalSender = (
  emailType: CustomerEmailType
): Omit<ResolvedCustomerSender, "brandId"> | null => {
  const pass = process.env.CUSTOMER_PORTAL_SMTP_PASSWORD?.trim();
  if (!pass) return null;

  const host =
    process.env.CUSTOMER_PORTAL_SMTP_HOST?.trim() || "globalwebbuilders.com";
  const user =
    process.env.CUSTOMER_PORTAL_SMTP_EMAIL?.trim() ||
    "support@globalwebbuilders.com";
  const port = Number(process.env.CUSTOMER_PORTAL_SMTP_PORT || "465");
  const fromName =
    process.env.CUSTOMER_PORTAL_EMAIL_BRAND_NAME?.trim() ||
    process.env.CUSTOMER_PORTAL_SMTP_FROM_NAME?.trim() ||
    CUSTOMER_EMAIL_TYPE_LABELS[emailType];
  const replyTo =
    process.env.CUSTOMER_PORTAL_REPLY_TO?.trim() || user;

  return {
    emailType,
    source: "legacy",
    host,
    port: Number.isFinite(port) && port > 0 ? port : 465,
    user,
    pass,
    fromName,
    replyTo,
  };
};

export const resolveCustomerSender = async (params: {
  brandId?: number | null;
  emailType: CustomerEmailType;
  fromNameOverride?: string;
}): Promise<ResolvedCustomerSender> => {
  const { brandId, emailType, fromNameOverride } = params;

  if (brandId != null) {
    const row = await BrandEmailSender.findOne({
      where: { brandId, emailType, isActive: true },
    });
    if (row) {
      const pass = decryptSmtpPassword(row.smtpPassword);
      if (pass) {
        return {
          emailType,
          brandId,
          source: "brand",
          host: row.smtpHost,
          port: row.smtpPort,
          user: row.smtpUser,
          pass,
          fromName:
            fromNameOverride?.trim() ||
            row.fromName?.trim() ||
            CUSTOMER_EMAIL_TYPE_LABELS[emailType],
          replyTo: row.replyTo?.trim() || row.smtpUser,
        };
      }
    }
  }

  const fromEnv = readEnvSender(emailType);
  if (fromEnv) {
    return {
      ...fromEnv,
      brandId: brandId ?? null,
      fromName: fromNameOverride?.trim() || fromEnv.fromName,
    };
  }

  const legacy = readLegacyPortalSender(emailType);
  if (legacy) {
    return {
      ...legacy,
      brandId: brandId ?? null,
      fromName: fromNameOverride?.trim() || legacy.fromName,
    };
  }

  throw new Error(
    `No SMTP configured for customer email type "${emailType}"` +
      (brandId != null ? ` (brand ${brandId})` : "") +
      `. Set brand sender in CRM or CUSTOMER_EMAIL_${emailType.toUpperCase()}_* in .env`
  );
};

export const getCustomerSenderAuditSnapshot = async (params: {
  brandId?: number | null;
  emailType: CustomerEmailType;
}) => {
  const sender = await resolveCustomerSender(params);
  return {
    emailType: sender.emailType,
    brandId: sender.brandId,
    source: sender.source,
    host: sender.host,
    port: sender.port,
    user: sender.user,
    fromName: sender.fromName,
    replyTo: sender.replyTo,
  };
};
