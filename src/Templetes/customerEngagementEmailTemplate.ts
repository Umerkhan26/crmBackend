import {
  buildCustomerPortalEmailHtml,
  CUSTOMER_EMAIL_BRAND_NAME,
} from "../utils/customerPortalEmail";

export const customerEngagementEmailTemplate = (data: {
  firstname?: string | null;
  lastname?: string | null;
  subject: string;
  body: string;
}): { subject: string; html: string; brandName: string } => {
  const subject = String(data.subject || "").trim() || `Message from ${CUSTOMER_EMAIL_BRAND_NAME}`;
  return {
    subject,
    html: buildCustomerPortalEmailHtml({
      firstname: data.firstname,
      lastname: data.lastname,
      subject,
      body: data.body,
    }),
    brandName: CUSTOMER_EMAIL_BRAND_NAME,
  };
};
