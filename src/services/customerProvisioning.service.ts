import bcrypt from "bcrypt";
import User from "../models/user.model";
import CustomerAccount from "../models/customerAccount.model";
import Brand from "../models/brand.model";
import Lead from "../models/lead.model";
import ProductSale from "../models/product.model";
import Role from "../models/role.model";
import { generateTemporaryPassword } from "../utils/generatePassword";
import {
  extractEmailFromLeadData,
  extractNameFromLeadData,
} from "../utils/extractLeadContact";
import { getSmtpConfig } from "../utils/getSmtpConfig";
import { sendEmail } from "../utils/email";
import { customerCredentialsTemplate } from "../Templetes/customerCredentialsTemplate";
import { normalizePortalBaseUrl } from "../utils/portalHost";

const resolveBrandPortalUrl = (_brand: Brand | null) => normalizePortalBaseUrl();

export interface ProvisionCustomerResult {
  provisioned: boolean;
  skipped?: boolean;
  reason?: string;
  userId?: number;
  customerAccountId?: number;
  emailSent?: boolean;
}

async function resolveCustomerRoleId(): Promise<number> {
  const envRoleId = process.env.CUSTOMER_DEFAULT_ROLE_ID;
  if (envRoleId) {
    const parsed = Number(envRoleId);
    if (!Number.isNaN(parsed)) return parsed;
  }

  const role =
    (await Role.findOne({ where: { name: "customer" } })) ||
    (await Role.findOne({ where: { name: "client" } }));

  if (!role?.id) {
    throw new Error(
      "Customer role not found. Create a 'customer' role or set CUSTOMER_DEFAULT_ROLE_ID in .env"
    );
  }
  return role.id;
}

async function hashPassword(plainPassword: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plainPassword, salt);
}

async function sendCredentialsEmail(params: {
  agentUserId: number;
  to: string;
  firstname: string;
  lastname: string;
  plainPassword: string;
  brandName: string;
  portalUrl?: string;
}): Promise<boolean> {
  try {
    const smtpConfig = await getSmtpConfig(params.agentUserId);
    const { subject, html } = customerCredentialsTemplate({
      firstname: params.firstname,
      lastname: params.lastname,
      email: params.to,
      password: params.plainPassword,
      brandName: params.brandName,
      portalUrl: params.portalUrl,
    });
    await sendEmail({
      smtp: smtpConfig,
      to: params.to,
      subject,
      body: html,
    });
    return true;
  } catch {
    return false;
  }
}

/** Reset portal password and e-mail a new easy temporary password (resend). */
export const resendCustomerCredentials = async (params: {
  saleId: number;
  leadId: number;
  brandId?: number | null;
  agentUserId: number;
}): Promise<ProvisionCustomerResult> => {
  const { saleId, leadId, brandId = null, agentUserId } = params;

  const sale = await ProductSale.findByPk(saleId);
  if (!sale) throw new Error("Sale not found");

  const lead = await Lead.findByPk(leadId);
  if (!lead) throw new Error("Lead not found");

  const email = extractEmailFromLeadData(lead.leadData);
  if (!email) {
    return { provisioned: false, skipped: true, reason: "lead_missing_email" };
  }

  const account = await CustomerAccount.findOne({ where: { saleId } });
  if (!account?.userId) {
    return {
      provisioned: false,
      skipped: true,
      reason: "no_customer_account",
    };
  }

  const user = await User.findByPk(account.userId);
  if (!user) throw new Error("Customer user not found");

  const role = user.userrole?.toLowerCase();
  if (role && role !== "customer" && role !== "client") {
    return { provisioned: false, skipped: true, reason: "email_used_by_staff" };
  }

  const brand = brandId ? await Brand.findByPk(brandId) : null;
  const brandName = brand?.name || "Customer Portal";
  const { firstname, lastname } = extractNameFromLeadData(lead.leadData);
  const plainPassword = generateTemporaryPassword();
  const hashedPassword = await hashPassword(plainPassword);

  await user.update({
    password: hashedPassword,
    brandId: brandId ?? user.brandId,
    userrole: "customer" as any,
  });

  const emailSent = await sendCredentialsEmail({
    agentUserId,
    to: email,
    firstname,
    lastname,
    plainPassword,
    brandName,
    portalUrl: resolveBrandPortalUrl(brand),
  });

  return {
    provisioned: false,
    skipped: false,
    reason: "credentials_resent",
    userId: user.id,
    customerAccountId: account.id,
    emailSent,
  };
};

export const provisionCustomerFromSale = async (params: {
  saleId: number;
  leadId: number;
  brandId?: number | null;
  agentUserId: number;
  shouldSendCredentialsEmail?: boolean;
}): Promise<ProvisionCustomerResult> => {
  const {
    saleId,
    leadId,
    brandId = null,
    agentUserId,
    shouldSendCredentialsEmail = true,
  } = params;

  const sale = await ProductSale.findByPk(saleId);
  if (!sale) throw new Error("Sale not found");

  const existingAccount = await CustomerAccount.findOne({ where: { saleId } });
  if (sale.customerProvisionedAt || existingAccount) {
    return resendCustomerCredentials({
      saleId,
      leadId,
      brandId,
      agentUserId,
    });
  }

  const lead = await Lead.findByPk(leadId);
  if (!lead) throw new Error("Lead not found");

  const email = extractEmailFromLeadData(lead.leadData);
  if (!email) {
    return {
      provisioned: false,
      skipped: true,
      reason: "lead_missing_email",
    };
  }

  const brand = brandId ? await Brand.findByPk(brandId) : null;
  const brandName = brand?.name || "Customer Portal";

  const { firstname, lastname } = extractNameFromLeadData(lead.leadData);
  const plainPassword = generateTemporaryPassword();
  const roleId = await resolveCustomerRoleId();
  const hashedPassword = await hashPassword(plainPassword);

  let user = await User.findOne({ where: { email } });

  if (!user) {
    user = await User.create({
      email,
      password: hashedPassword,
      firstname,
      lastname,
      roleId,
      brandId: brandId ?? undefined,
      userrole: "customer",
      status: "active",
      created_at: new Date(),
      updated_at: new Date(),
    } as any);
  } else {
    const role = user.userrole?.toLowerCase();
    if (role && role !== "customer" && role !== "client") {
      return {
        provisioned: false,
        skipped: true,
        reason: "email_used_by_staff",
      };
    }
    await user.update({
      password: hashedPassword,
      brandId: brandId ?? undefined,
      userrole: "customer" as any,
    });
  }

  if (!user.id) throw new Error("Failed to create customer user");

  let account = await CustomerAccount.findOne({ where: { saleId } });

  if (!account) {
    account = await CustomerAccount.create({
      userId: user.id,
      brandId: brandId ?? null,
      leadId,
      saleId,
      status: "active",
    });
  } else {
    await account.update({
      leadId,
      brandId: brandId ?? account.brandId,
    });
  }

  if (brandId && !lead.brandId) {
    await lead.update({ brandId });
  }

  await sale.update({
    brandId: brandId ?? sale.brandId,
    customerProvisionedAt: new Date(),
  });

  const emailSent = shouldSendCredentialsEmail
    ? await sendCredentialsEmail({
        agentUserId,
        to: email,
        firstname,
        lastname,
        plainPassword,
        brandName,
        portalUrl: resolveBrandPortalUrl(brand),
      })
    : false;

  return {
    provisioned: true,
    userId: user.id,
    customerAccountId: account.id,
    emailSent,
  };
};
