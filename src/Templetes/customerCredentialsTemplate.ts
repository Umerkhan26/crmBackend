import { CUSTOMER_EMAIL_BRAND_NAME } from "../utils/customerPortalEmail";

/**
 * GWB / customer portal welcome email — same layout as userRegistrationTemplate (xCRM welcome).
 */
export const customerCredentialsTemplate = (data: {
  firstname: string;
  lastname: string;
  email: string;
  password: string;
  brandName?: string;
  portalUrl?: string;
}): { subject: string; html: string } => {
  const brand = CUSTOMER_EMAIL_BRAND_NAME;
  const subject = `Welcome to ${brand}`;

  const portalHost = (data.portalUrl || "https://customerarea.live")
    .replace(/^https?:\/\//i, "")
    .replace(/\/$/, "");

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.2; text-align: center; background: linear-gradient(135deg, #f8f9ff 0%, #f5f0ff 100%); padding: 12px; border-top: 3px solid #5664d2;">
      <h2 style="margin: 0 0 4px 0; font-size: 18px; font-weight: 600; color: #5664d2;">Hello ${data.firstname} ${data.lastname},</h2>
      <p style="margin: 0 0 2px 0;">Thank you for registering with <strong style="color: #5664d2;">${brand}</strong>!</p>
      <p style="margin: 0 0 2px 0;">Your account has been successfully created with the email: <strong>${data.email}</strong></p>
      <p style="margin: 0 0 2px 0;">Your password: <strong>${data.password}</strong></p>
      <p style="margin: 4px 0 2px 0;">You can now log in at <strong>${portalHost}</strong> to track your orders, invoices, and offers.</p>
      <p style="margin: 4px 0 0 0; color: #5664d2;"><strong>Best regards,</strong><br/>${brand} Team</p>
    </div>
  `;

  return { subject, html };
};
