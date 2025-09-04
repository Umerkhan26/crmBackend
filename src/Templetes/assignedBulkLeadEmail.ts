export const assignedBulkLeadEmailTemplate = (count: number) => {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8" />
    <title>Lead Assignment</title>
  </head>
  <body style="margin:0; padding:0; font-family: Arial, sans-serif; background:#f9f9f9; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0; padding:0; border-collapse:collapse; border-spacing:0; line-height:100%;">
      <tr>
        <td align="center" style="margin:0; padding:0;">
          <table width="600" cellpadding="0" cellspacing="0" border="0" style="margin:0; padding:0; background:#ffffff; border-radius:8px; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,0.1);">
            
            <!-- Header -->
            <tr>
              <td style="background:#1976D2; text-align:center; color:#ffffff;">
                <div style="padding:15px 20px; line-height:1;">
                  <span style="font-size:22px; font-weight:bold; display:block;">Lead Assignment</span>
                </div>
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td style="padding:30px; text-align:left; color:#333333;">
                <p style="font-size:16px; margin:0 0 16px 0;">Hello,</p>
                <p style="font-size:16px; margin:0 0 16px 0;">
                  You have been assigned <strong>${count}</strong> new ${count === 1 ? "lead" : "leads"}.
                </p>
                <p style="font-size:14px; color:#666666; margin:0;">Please log in to your dashboard to review them.</p>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding:20px; background:#f4f4f4; text-align:center; font-size:12px; color:#777777;">
                &copy; ${new Date().getFullYear()} Your Company. All rights reserved.
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
