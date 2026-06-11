// Base email template with CRM theme - Standard email design like Gmail
export const baseEmailTemplate = (options: {
  title: string;
  content: string;
  primaryColor?: string;
  accentColor?: string;
  footerText?: string;
  replyNotice?: string;
}) => {
  const primaryColor = options.primaryColor || "#5664d2";
  const accentColor = options.accentColor || "#764ba2";
  const footerText = options.footerText || `© ${new Date().getFullYear()} XCRM. All rights reserved.`;
  const replyNotice =
    options.replyNotice || "This is an automated email from XCRM. Please do not reply.";

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>${options.title}</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f5f5f5; padding: 20px 0;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; background: linear-gradient(135deg, #f8f9ff 0%, #f5f0ff 100%); border-top: 3px solid ${primaryColor};">
              <tr>
                <td style="padding: 20px; text-align: center;">
                  <h2 style="margin: 0 0 10px 0; font-size: 18px; font-weight: 600; color: ${primaryColor};">${options.title}</h2>
                  <div style="margin: 0 0 10px 0; color: #212529; text-align: left; line-height: 1.5;">
                    ${options.content}
                  </div>
                  <p style="margin: 10px 0 0 0; font-size: 12px; color: #6c757d; line-height: 1.4; text-align: center;">
                    ${footerText} | ${replyNotice}
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
};

