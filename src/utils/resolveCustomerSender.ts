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
  source: "brand" | "env";
  replyTo?: string;
};

/** Only these mailbox prefixes are valid for customer sends (never support@). */
export const ALLOWED_CUSTOMER_MAILBOX_PREFIXES = [
  "care@",
  "invoice@",
  "promotions@",
] as const;

export const isAllowedCustomerMailbox = (smtpUser: string): boolean => {
  const user = String(smtpUser || "").trim().toLowerCase();
  if (!user || user.startsWith("support@")) return false;
  return ALLOWED_CUSTOMER_MAILBOX_PREFIXES.some((prefix) =>
    user.startsWith(prefix)
  );
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
  if (!isAllowedCustomerMailbox(user)) return null;

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
    if (row && isAllowedCustomerMailbox(row.smtpUser)) {
      let pass = "";
      try {
        pass = decryptSmtpPassword(row.smtpPassword);
      } catch (err) {
        console.warn(
          `[email] Brand ${brandId} ${emailType} password decrypt failed — using env fallback`
        );
      }
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
            row.fromName?.trim() ||
            fromNameOverride?.trim() ||
            CUSTOMER_EMAIL_TYPE_LABELS[emailType],
          replyTo: row.replyTo?.trim() || row.smtpUser,
        };
      }
    } else if (row && !isAllowedCustomerMailbox(row.smtpUser)) {
      console.warn(
        `[email] Brand ${brandId} ${emailType} uses disallowed mailbox ${row.smtpUser} — using env fallback`
      );
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

  throw new Error(
    `No SMTP configured for customer email type "${emailType}"` +
      (brandId != null ? ` (brand ${brandId})` : "") +
      `. Configure brand sender (care@ / invoice@ / promotions@) in CRM or CUSTOMER_EMAIL_${emailType.toUpperCase()}_* in .env`
  );
};

/** .env CUSTOMER_EMAIL_{TYPE}_* fallback (GWB defaults). */
export const resolveEnvCustomerSender = (
  emailType: CustomerEmailType,
  brandId?: number | null
): ResolvedCustomerSender | null => {
  const fromEnv = readEnvSender(emailType);
  if (!fromEnv) return null;
  return { ...fromEnv, brandId: brandId ?? null };
};

export const isSmtpAuthError = (err: unknown): boolean => {
  const e = err as { message?: string; code?: string; responseCode?: number };
  const msg = String(e?.message || err || "").toLowerCase();
  return (
    e?.code === "EAUTH" ||
    e?.responseCode === 535 ||
    msg.includes("535") ||
    msg.includes("authentication") ||
    msg.includes("invalid login")
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
