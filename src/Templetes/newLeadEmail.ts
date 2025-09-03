export const newLeadEmailTemplate = (leadId?: number) => {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8" />
    <title>New Lead Assigned</title>
  </head>
  <body style="margin:0; padding:0; font-family: Arial, sans-serif; background:#f4f4f4;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0; padding:20px;">
      <tr>
        <td align="center">
          <table width="600" cellpadding="0" cellspacing="0" border="0" style="background:#fff; border-radius:8px; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,0.1);">
            <tr>
              <td style="background:#4CAF50; padding:20px; text-align:center; color:#fff;">
                <h1 style="margin:0; padding:0; font-size:24px; line-height:28px;">New Lead Assigned</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:30px; text-align:left; color:#333;">
                <p style="font-size:16px; margin:0 0 16px 0;">Hello,</p>
                <p style="font-size:16px; margin:0 0 16px 0;">
                  You have been assigned 
                  <strong>${leadId ? `Lead ID: ${leadId}` : "a new lead"}</strong>.
                </p>
                <p style="font-size:14px; color:#666; margin:0;">Please check your dashboard for more details.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px; background:#f4f4f4; text-align:center; font-size:12px; color:#777;">
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
