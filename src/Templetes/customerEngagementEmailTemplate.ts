import { buildCustomerPortalEmailHtml } from "../utils/customerPortalEmail";
import { type CustomerEmailBrandTheme } from "../utils/customerEmailBrandTheme";

export const customerEngagementEmailTemplate = (data: {
  firstname?: string | null;
  lastname?: string | null;
  subject: string;
  body: string;
  theme?: CustomerEmailBrandTheme;
}): { subject: string; html: string; brandName: string } => {
  const subject =
    String(data.subject || "").trim() ||
    `Message from ${data.theme?.brandLabel || "GWB"}`;

  return {
    subject,
    html: buildCustomerPortalEmailHtml({
      firstname: data.firstname,
      lastname: data.lastname,
      subject,
      body: data.body,
      theme: data.theme,
    }),
    brandName: data.theme?.brandName || "GWB",
  };
};
