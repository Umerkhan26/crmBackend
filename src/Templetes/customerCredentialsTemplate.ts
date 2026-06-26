import {
  customerBrandedEmailTemplate,
  customerCredentialBoxHtml,
} from "./customerBrandedEmailTemplate";
import {
  type CustomerEmailBrandTheme,
  buildCustomerEmailBrandTheme,
  getCustomerEmailBrandThemeFromBrand,
} from "../utils/customerEmailBrandTheme";
import Brand from "../models/brand.model";

export const customerCredentialsTemplate = (data: {
  firstname: string;
  lastname: string;
  email: string;
  password: string;
  brand?: Brand | null;
  theme?: CustomerEmailBrandTheme;
  portalUrl?: string;
}): { subject: string; html: string } => {
  const theme =
    data.theme ||
    getCustomerEmailBrandThemeFromBrand(data.brand) ||
    buildCustomerEmailBrandTheme("gwb");

  const subject = `Welcome to ${theme.brandLabel}`;
  const portalUrl = data.portalUrl || theme.portalUrl;
  const portalHost = portalUrl
    .replace(/^https?:\/\//i, "")
    .replace(/\/$/, "");

  const fullName = [data.firstname, data.lastname]
    .map((s) => String(s || "").trim())
    .filter(Boolean)
    .join(" ");

  const html = customerBrandedEmailTemplate({
    theme,
    title: "Welcome to your portal",
    preheader: `Your ${theme.brandLabel} customer portal account is ready.`,
    greeting: fullName ? `Hello ${fullName},` : "Hello,",
    contentHtml: customerCredentialBoxHtml({
      theme,
      email: data.email,
      password: data.password,
      portalHost,
    }),
    cta: {
      label: "Access your portal",
      url: portalUrl.startsWith("http") ? portalUrl : `https://${portalUrl}`,
    },
  });

  return { subject, html };
};
