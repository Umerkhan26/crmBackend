import Brand from "../models/brand.model";
import BrandEmailSender from "../models/brandEmailSender.model";
import {
  type CustomerEmailType,
  parseCustomerEmailType,
} from "../constants/customerEmailTypes";
import {
  ensureCustomerEmailTypesCache,
  getCustomerEmailTypeLabel,
  isMailboxAllowedForEmailType,
  listCustomerEmailTypes as listDynamicCustomerEmailTypes,
} from "../services/customerEmailType.service";
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
import { buildCustomerEmailBrandTheme } from "../utils/customerEmailBrandTheme";

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

export const listCustomerEmailTypes = async () => {
  await ensureCustomerEmailTypesCache();
  const types = await listDynamicCustomerEmailTypes();
  return types.map((t) => {
    const envSender = resolveEnvCustomerSender(t.slug);
    return {
      emailType: t.slug,
      slug: t.slug,
      label: t.label,
      mailboxPrefix: t.mailboxPrefix,
      defaultUser: envSender?.user || null,
    };
  });
};

export const listBrandEmailSenders = async (brandId: number) => {
  const brand = await Brand.findByPk(brandId);
  if (!brand) throw new Error("Brand not found");

  await ensureCustomerEmailTypesCache();
  const typeRows = await listDynamicCustomerEmailTypes();

  const rows = await BrandEmailSender.findAll({
    where: { brandId },
    order: [["emailType", "ASC"]],
  });

  const byType = new Map(rows.map((r) => [r.emailType, r]));

  const senders = await Promise.all(
    typeRows.map(async (typeRow) => {
      const emailType = typeRow.slug;
      const configured = byType.get(emailType);
      let effective = null;
      try {
        effective = await getCustomerSenderAuditSnapshot({ brandId, emailType });
      } catch {
        effective = null;
      }
      return {
        emailType,
        label: typeRow.label,
        mailboxPrefix: typeRow.mailboxPrefix,
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

  await ensureCustomerEmailTypesCache();
  const emailType = parseCustomerEmailType(rawType);
  if (!smtpHost?.trim() || !smtpUser?.trim()) {
    throw new Error("SMTP host and user are required");
  }
  if (!isMailboxAllowedForEmailType(smtpUser.trim(), emailType)) {
    throw new Error(
      `SMTP user must start with the mailbox prefix for type "${emailType}" (e.g. ${emailType}@yourdomain.com)`
    );
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
  await ensureCustomerEmailTypesCache();
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
  const theme = buildCustomerEmailBrandTheme(brand.slug || brand.name);
  const subject = `Test — ${getCustomerEmailTypeLabel(emailType)} (${brand.name})`;
  const body = buildCustomerPortalEmailHtml({
    subject,
    body:
      `This is a test email from ${brand.name} using the **${getCustomerEmailTypeLabel(emailType)}** sender (${resolved.user}).`,
    theme,
  });

  await sendCustomerPortalEmail({
    to,
    subject,
    body,
    brandId,
    emailType,
    theme,
  });

  return {
    sentTo: to,
    emailType,
    from: resolved.user,
    source: resolved.source,
  };
};
