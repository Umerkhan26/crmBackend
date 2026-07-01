import bcrypt from "bcrypt";
import User from "../models/user.model";
import PortalCustomer from "../models/portalCustomer.model";
import CustomerAccount from "../models/customerAccount.model";
import Brand from "../models/brand.model";
import Lead from "../models/lead.model";
import ProductSale from "../models/product.model";
import { generateTemporaryPassword } from "../utils/generatePassword";
import {
  extractEmailFromLeadData,
  extractNameFromLeadData,
} from "../utils/extractLeadContact";
import { sendCustomerPortalEmail } from "../utils/customerPortalEmail";
import { CUSTOMER_EMAIL_TYPE_DEFAULTS } from "../constants/customerEmailTypes";
import { getCustomerEmailBrandThemeFromBrand } from "../utils/customerEmailBrandTheme";
import { customerCredentialsTemplate } from "../Templetes/customerCredentialsTemplate";
import { customerInvoiceEmailTemplate } from "../Templetes/customerInvoiceEmailTemplate";
import { normalizePortalBaseUrl } from "../utils/portalHost";

const resolveBrandPortalUrl = (_brand: Brand | null) => normalizePortalBaseUrl();

export interface ProvisionCustomerResult {
  provisioned: boolean;
  skipped?: boolean;
  reason?: string;
  portalCustomerId?: number;
  /** @deprecated use portalCustomerId — kept for older CRM clients */
  userId?: number;
  customerAccountId?: number;
  emailSent?: boolean;
  invoiceEmailSent?: boolean;
}

async function hashPassword(plainPassword: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plainPassword, salt);
}

async function sendInvoiceEmail(params: {
  to: string;
  firstname: string;
  lastname: string;
  leadId: number;
  saleId: number;
  brand?: Brand | null;
  portalUrl?: string;
}): Promise<boolean> {
  try {
    const { getInvoiceByLeadId } = await import("./product.service");
    const invoice = await getInvoiceByLeadId(params.leadId);
    const theme = getCustomerEmailBrandThemeFromBrand(params.brand);
    const { subject, html } = customerInvoiceEmailTemplate({
      firstname: params.firstname,
      lastname: params.lastname,
      brand: params.brand,
      theme,
      portalUrl: params.portalUrl,
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: invoice.date,
      saleId: params.saleId,
      status: invoice.sale?.status,
      products: invoice.products,
      totalAmount: invoice.totalAmount,
    });
    await sendCustomerPortalEmail({
      to: params.to,
      subject,
      body: html,
      theme,
      brandId: params.brand?.id ?? null,
      emailType: CUSTOMER_EMAIL_TYPE_DEFAULTS.invoice,
    });
    return true;
  } catch {
    return false;
  }
}

async function sendWelcomeEmails(params: {
  to: string;
  firstname: string;
  lastname: string;
  plainPassword: string;
  leadId: number;
  saleId: number;
  brand?: Brand | null;
  portalUrl?: string;
}): Promise<{ credentialsSent: boolean; invoiceSent: boolean }> {
  const credentialsSent = await sendCredentialsEmail({
    to: params.to,
    firstname: params.firstname,
    lastname: params.lastname,
    plainPassword: params.plainPassword,
    brand: params.brand,
    portalUrl: params.portalUrl,
  });
  const invoiceSent = await sendInvoiceEmail({
    to: params.to,
    firstname: params.firstname,
    lastname: params.lastname,
    leadId: params.leadId,
    saleId: params.saleId,
    brand: params.brand,
    portalUrl: params.portalUrl,
  });
  return { credentialsSent, invoiceSent };
}

async function sendCredentialsEmail(params: {
  to: string;
  firstname: string;
  lastname: string;
  plainPassword: string;
  brand?: Brand | null;
  portalUrl?: string;
}): Promise<boolean> {
  try {
    const theme = getCustomerEmailBrandThemeFromBrand(params.brand);
    const { subject, html } = customerCredentialsTemplate({
      firstname: params.firstname,
      lastname: params.lastname,
      email: params.to,
      password: params.plainPassword,
      brand: params.brand,
      theme,
      portalUrl: params.portalUrl,
    });
    await sendCustomerPortalEmail({
      to: params.to,
      subject,
      body: html,
      theme,
      brandId: params.brand?.id ?? null,
      emailType: CUSTOMER_EMAIL_TYPE_DEFAULTS.credentials,
    });
    return true;
  } catch {
    return false;
  }
}

async function assertEmailNotUsedByStaff(email: string): Promise<boolean> {
  const staffUser = await User.findOne({ where: { email } });
  if (!staffUser) return true;
  const role = String(staffUser.userrole || "").toLowerCase();
  return role === "customer" || role === "client";
}

async function findOrCreatePortalCustomer(params: {
  email: string;
  firstname: string;
  lastname: string;
  hashedPassword: string;
  brandId?: number | null;
}): Promise<PortalCustomer> {
  let portalCustomer = await PortalCustomer.findOne({
    where: { email: params.email },
  });

  if (!portalCustomer) {
    portalCustomer = await PortalCustomer.create({
      email: params.email,
      password: params.hashedPassword,
      firstname: params.firstname,
      lastname: params.lastname,
      brandId: params.brandId ?? null,
      status: "active",
    });
    return portalCustomer;
  }

  await portalCustomer.update({
    password: params.hashedPassword,
    firstname: params.firstname,
    lastname: params.lastname,
    brandId: params.brandId ?? portalCustomer.brandId,
  });

  return portalCustomer;
}

/** Reset portal password and e-mail a new easy temporary password (resend). */
export const resendCustomerCredentials = async (params: {
  saleId: number;
  leadId: number;
  brandId?: number | null;
  agentUserId: number;
}): Promise<ProvisionCustomerResult> => {
  const { saleId, leadId, brandId = null } = params;

  const sale = await ProductSale.findByPk(saleId);
  if (!sale) throw new Error("Sale not found");

  const lead = await Lead.findByPk(leadId);
  if (!lead) throw new Error("Lead not found");

  const email = extractEmailFromLeadData(lead.leadData);
  if (!email) {
    return { provisioned: false, skipped: true, reason: "lead_missing_email" };
  }

  const account = await CustomerAccount.findOne({ where: { saleId } });
  if (!account?.portalCustomerId) {
    return {
      provisioned: false,
      skipped: true,
      reason: "no_customer_account",
    };
  }

  const portalCustomer = await PortalCustomer.findByPk(account.portalCustomerId);
  if (!portalCustomer) throw new Error("Portal customer not found");

  const brand = brandId ? await Brand.findByPk(brandId) : null;
  const { firstname, lastname } = extractNameFromLeadData(lead.leadData);
  const plainPassword = generateTemporaryPassword();
  const hashedPassword = await hashPassword(plainPassword);

  await portalCustomer.update({
    password: hashedPassword,
    brandId: brandId ?? portalCustomer.brandId,
  });

  const { credentialsSent, invoiceSent } = await sendWelcomeEmails({
    to: email,
    firstname,
    lastname,
    plainPassword,
    leadId,
    saleId,
    brand,
    portalUrl: resolveBrandPortalUrl(brand),
  });

  return {
    provisioned: false,
    skipped: false,
    reason: "credentials_resent",
    portalCustomerId: portalCustomer.id,
    userId: portalCustomer.id,
    customerAccountId: account.id,
    emailSent: credentialsSent,
    invoiceEmailSent: invoiceSent,
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
      agentUserId: params.agentUserId,
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

  if (!(await assertEmailNotUsedByStaff(email))) {
    return {
      provisioned: false,
      skipped: true,
      reason: "email_used_by_staff",
    };
  }

  const brand = brandId ? await Brand.findByPk(brandId) : null;

  const { firstname, lastname } = extractNameFromLeadData(lead.leadData);
  const plainPassword = generateTemporaryPassword();
  const hashedPassword = await hashPassword(plainPassword);

  const portalCustomer = await findOrCreatePortalCustomer({
    email,
    firstname,
    lastname,
    hashedPassword,
    brandId,
  });

  let account = await CustomerAccount.findOne({ where: { saleId } });

  if (!account) {
    account = await CustomerAccount.create({
      portalCustomerId: portalCustomer.id,
      brandId: brandId ?? null,
      leadId,
      saleId,
      status: "active",
    });
  } else {
    await account.update({
      portalCustomerId: portalCustomer.id,
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

  const welcomeEmails = shouldSendCredentialsEmail
    ? await sendWelcomeEmails({
        to: email,
        firstname,
        lastname,
        plainPassword,
        leadId,
        saleId,
        brand,
        portalUrl: resolveBrandPortalUrl(brand),
      })
    : { credentialsSent: false, invoiceSent: false };

  try {
    const { enrollCustomerInFollowUps } = await import("./followUpEmail.service");
    await enrollCustomerInFollowUps({
      customerAccountId: account.id,
      enrolledBy: params.agentUserId,
    });
  } catch (err: any) {
    console.warn(
      "follow-up enrollment warning:",
      err?.message || err
    );
  }

  return {
    provisioned: true,
    portalCustomerId: portalCustomer.id,
    userId: portalCustomer.id,
    customerAccountId: account.id,
    emailSent: welcomeEmails.credentialsSent,
    invoiceEmailSent: welcomeEmails.invoiceSent,
  };
};
