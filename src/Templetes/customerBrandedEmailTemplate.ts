import {
  type CustomerEmailBrandTheme,
  getCustomerEmailHeaderImage,
} from "../utils/customerEmailBrandTheme";

const escapeHtml = (raw: string) =>
  raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export type CustomerBrandedEmailOptions = {
  theme: CustomerEmailBrandTheme;
  title: string;
  preheader?: string;
  greeting?: string;
  contentHtml: string;
  cta?: { label: string; url: string };
  footerNote?: string;
};

export const customerBrandedEmailTemplate = (
  options: CustomerBrandedEmailOptions
): string => {
  const { theme, title, contentHtml, cta, footerNote } = options;
  const greeting = options.greeting?.trim();
  const year = new Date().getFullYear();
  const headerImage = getCustomerEmailHeaderImage(theme);

  const iconImg = headerImage
    ? headerImage.variant === "icon"
      ? `<img src="${escapeHtml(headerImage.url)}" alt="${escapeHtml(theme.brandLabel)}" width="52" height="52" style="display:block;border-radius:12px;background:#ffffff;padding:8px;box-shadow:0 2px 8px rgba(0,0,0,0.12);" />`
      : `<img src="${escapeHtml(headerImage.url)}" alt="${escapeHtml(theme.brandLabel)}" style="display:block;max-width:200px;max-height:56px;height:auto;width:auto;border-radius:8px;" />`
    : `<div style="display:inline-block;min-width:52px;height:52px;line-height:52px;border-radius:12px;background:#ffffff;color:${theme.primaryColor};font-size:18px;font-weight:700;padding:0 14px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,0.12);">${escapeHtml(theme.brandName.slice(0, 2).toUpperCase())}</div>`;

  const headerBlock =
    headerImage?.variant === "logo"
      ? `<div style="text-align:left;">${iconImg}</div>`
      : `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td align="left" valign="middle" style="width:52px;padding-right:16px;">
          ${iconImg}
        </td>
        <td align="left" valign="middle">
          <p style="margin:0;font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-0.02em;line-height:1.25;">${escapeHtml(theme.brandLabel)}</p>
          <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.92);line-height:1.4;">${escapeHtml(theme.tagline)}</p>
        </td>
      </tr>
    </table>`;

  const greetingBlock = greeting
    ? `<p style="margin:0 0 18px 0;font-size:17px;font-weight:600;color:${theme.primaryColor};line-height:1.4;">${escapeHtml(greeting)}</p>`
    : "";

  const ctaBlock = cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px auto 0;">
        <tr>
          <td align="center" style="border-radius:8px;background:${theme.primaryColor};">
            <a href="${escapeHtml(cta.url)}" target="_blank" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">${escapeHtml(cta.label)}</a>
          </td>
        </tr>
      </table>`
    : "";

  const supportLine = theme.supportEmail
    ? `<p style="margin:8px 0 0;font-size:12px;color:${theme.mutedColor};">Need help? <a href="mailto:${escapeHtml(theme.supportEmail)}" style="color:${theme.primaryColor};text-decoration:none;">${escapeHtml(theme.supportEmail)}</a></p>`
    : "";

  const preheader = options.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${escapeHtml(options.preheader)}</div>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background-color:#e8ecf1;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;">
  ${preheader}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#e8ecf1;">
    <tr>
      <td align="center" style="padding:36px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(15,23,42,0.1);">
          <tr>
            <td style="background:linear-gradient(135deg, ${theme.primaryColor} 0%, ${theme.accentColor} 100%);padding:28px 32px;text-align:left;">
              ${headerBlock}
            </td>
          </tr>
          <tr>
            <td style="padding:36px 32px;background-color:${theme.bgColor};">
              <p style="margin:0 0 6px;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:${theme.mutedColor};">${escapeHtml(title)}</p>
              ${greetingBlock}
              <div style="color:${theme.textColor};font-size:15px;line-height:1.65;">
                ${contentHtml}
              </div>
              ${ctaBlock}
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px;background-color:#f8f9fb;border-top:1px solid #e9ecef;text-align:center;">
              <p style="margin:0;font-size:13px;color:${theme.mutedColor};line-height:1.5;">
                <strong style="color:${theme.textColor};">Best regards,</strong><br/>
                ${escapeHtml(theme.brandLabel)} Team
              </p>
              ${supportLine}
              <p style="margin:16px 0 0;font-size:11px;color:#9ca3af;line-height:1.5;">
                © ${year} ${escapeHtml(theme.brandLabel)}. All rights reserved.
              </p>
              <p style="margin:6px 0 0;font-size:11px;color:#adb5bd;line-height:1.4;">
                ${escapeHtml(footerNote || `This is an automated message from ${theme.brandLabel}. Please do not reply to this email.`)}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

export const customerCredentialBoxHtml = (params: {
  theme: CustomerEmailBrandTheme;
  email: string;
  password: string;
  portalHost: string;
}): string => {
  const { theme, email, password, portalHost } = params;
  return `
    <p style="margin:0 0 16px 0;">Thank you for choosing <strong style="color:${theme.primaryColor};">${escapeHtml(theme.brandLabel)}</strong>. Your customer portal account is ready.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px 0;background:#ffffff;border:1px solid #e9ecef;border-radius:12px;overflow:hidden;">
      <tr>
        <td style="padding:14px 18px;background:${theme.primaryColor};color:#ffffff;font-size:13px;font-weight:600;">Your login details</td>
      </tr>
      <tr>
        <td style="padding:18px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="padding:8px 0;font-size:13px;color:${theme.mutedColor};width:110px;">Email</td>
              <td style="padding:8px 0;font-size:14px;font-weight:600;color:${theme.textColor};">${escapeHtml(email)}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;font-size:13px;color:${theme.mutedColor};border-top:1px solid #f1f3f5;">Password</td>
              <td style="padding:8px 0;font-size:14px;font-weight:600;color:${theme.textColor};border-top:1px solid #f1f3f5;font-family:Consolas,Monaco,monospace;">${escapeHtml(password)}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;font-size:13px;color:${theme.mutedColor};border-top:1px solid #f1f3f5;">Portal</td>
              <td style="padding:8px 0;font-size:14px;color:${theme.primaryColor};border-top:1px solid #f1f3f5;">${escapeHtml(portalHost)}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
    <p style="margin:0;font-size:14px;color:${theme.mutedColor};">Use these credentials to sign in and track your orders, invoices, and exclusive offers.</p>
  `;
};
