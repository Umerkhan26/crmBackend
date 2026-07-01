import Brand from "../models/brand.model";
import BrandEmailSender from "../models/brandEmailSender.model";
import {
  CUSTOMER_EMAIL_TYPES,
  CUSTOMER_EMAIL_TYPE_LABELS,
  type CustomerEmailType,
  parseCustomerEmailType,
} from "../constants/customerEmailTypes";
import {
  encryptSmtpPassword,
  maskSmtpPassword,
} from "../utils/smtpSecret";
import {
  getCustomerSenderAuditSnapshot,
  resolveCustomerSender,
  resolveEnvCustomerSender,
} from "../utils/resolveCustomerSender";
import {
  buildCustomerPortalEmailHtml,
  sendCustomerPortalEmail,
} from "../utils/customerPortalEmail";

const toPublicSender = (row: BrandEmailSender) => ({
  id: row.id,
  brandId: row.brandId,
  emailType: row.emailType,
  smtpHost: row.smtpHost,
  smtpPort: row.smtpPort,
  smtpUser: row.smtpUser,
  fromName: row.fromName,
  replyTo: row.replyTo,
  isActive: row.isActive,
  passwordMasked: maskSmtpPassword(row.smtpPassword),
  hasPassword: !!row.smtpPassword,
  updatedAt: row.updatedAt,
});

export const listCustomerEmailTypes = () =>
  CUSTOMER_EMAIL_TYPES.map((emailType) => {
    const envSender = resolveEnvCustomerSender(emailType);
    return {
      emailType,
      label: CUSTOMER_EMAIL_TYPE_LABELS[emailType],
      defaultUser: envSender?.user || null,
    };
  });

export const listBrandEmailSenders = async (brandId: number) => {
  const brand = await Brand.findByPk(brandId);
  if (!brand) throw new Error("Brand not found");

  const rows = await BrandEmailSender.findAll({
    where: { brandId },
    order: [["emailType", "ASC"]],
  });

  const byType = new Map(rows.map((r) => [r.emailType, r]));

  const senders = await Promise.all(
    CUSTOMER_EMAIL_TYPES.map(async (emailType) => {
      const configured = byType.get(emailType);
      let effective = null;
      try {
        effective = await getCustomerSenderAuditSnapshot({ brandId, emailType });
      } catch {
        effective = null;
      }
      return {
        emailType,
        label: CUSTOMER_EMAIL_TYPE_LABELS[emailType],
        configured: configured ? toPublicSender(configured) : null,
        effective,
      };
    })
  );

  return { brandId, brandName: brand.name, senders };
};

export const upsertBrandEmailSender = async ({
  brandId,
  emailType: rawType,
  smtpHost,
  smtpPort,
  smtpUser,
  smtpPassword,
  fromName,
  replyTo,
  isActive = true,
}: {
  brandId: number;
  emailType: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPassword?: string;
  fromName?: string;
  replyTo?: string;
  isActive?: boolean;
}) => {
  const brand = await Brand.findByPk(brandId);
  if (!brand) throw new Error("Brand not found");

  const emailType = parseCustomerEmailType(rawType);
  if (!smtpHost?.trim() || !smtpUser?.trim()) {
    throw new Error("SMTP host and user are required");
  }
  const port = Number(smtpPort);
  if (!Number.isFinite(port) || port <= 0) {
    throw new Error("Invalid SMTP port");
  }

  const existing = await BrandEmailSender.findOne({
    where: { brandId, emailType },
  });

  const passwordPlain = smtpPassword?.trim();
  if (!existing && !passwordPlain) {
    throw new Error("SMTP password is required for new sender");
  }

  const payload = {
    brandId,
    emailType,
    smtpHost: smtpHost.trim(),
    smtpPort: port,
    smtpUser: smtpUser.trim(),
    smtpPassword: passwordPlain
      ? encryptSmtpPassword(passwordPlain)
      : existing!.smtpPassword,
    fromName: fromName?.trim() || null,
    replyTo: replyTo?.trim() || null,
    isActive: !!isActive,
  };

  if (existing) {
    await existing.update(payload);
    return toPublicSender(await existing.reload());
  }

  const created = await BrandEmailSender.create(payload);
  return toPublicSender(created);
};

export const deactivateBrandEmailSender = async (
  brandId: number,
  emailTypeRaw: string
) => {
  const emailType = parseCustomerEmailType(emailTypeRaw);
  const row = await BrandEmailSender.findOne({ where: { brandId, emailType } });
  if (!row) throw new Error("Sender not configured for this brand and type");
  await row.update({ isActive: false });
  return toPublicSender(row);
};

export const sendBrandEmailSenderTest = async ({
  brandId,
  emailType: rawType,
  toEmail,
}: {
  brandId: number;
  emailType: string;
  toEmail: string;
}) => {
  const emailType = parseCustomerEmailType(rawType) as CustomerEmailType;
  const to = toEmail?.trim();
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    throw new Error("Valid test recipient email required");
  }

  const brand = await Brand.findByPk(brandId);
  if (!brand) throw new Error("Brand not found");

  const resolved = await resolveCustomerSender({ brandId, emailType });
  const subject = `Test — ${CUSTOMER_EMAIL_TYPE_LABELS[emailType]} (${brand.name})`;
  const body = buildCustomerPortalEmailHtml({
    subject,
    body:
      `This is a test email from ${brand.name} using the **${CUSTOMER_EMAIL_TYPE_LABELS[emailType]}** sender (${resolved.user}).`,
  });

  await sendCustomerPortalEmail({
    to,
    subject,
    body,
    brandId,
    emailType,
  });

  return {
    sentTo: to,
    emailType,
    from: resolved.user,
    source: resolved.source,
  };
};
