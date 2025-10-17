export const reminderEmailTemplate = (reminderTitle?: string, reminderDate?: string) => {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8" />
    <title>Reminder Notification</title>
  </head>
  <body style="margin:0; padding:0; font-family: Arial, sans-serif; background:#f4f4f4;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td align="center">
          <table width="600" cellpadding="0" cellspacing="0" border="0" style="background:#fff; border-radius:8px; overflow:hidden;">
            <tr>
              <td style="background:#FF9800; text-align:center; color:#fff;">
                <div style="padding:10px 15px; line-height:1;">
                  <span style="font-size:22px; font-weight:bold; display:block;">Reminder Notification</span>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:20px; text-align:left; color:#333;">
                <p style="margin:0 0 12px 0; font-size:16px;">Hello,</p>
                <p style="margin:0 0 12px 0; font-size:16px;">
                  This is a friendly reminder for
                  <strong>${reminderTitle || "your scheduled task"}</strong>.
                </p>
                ${
                  reminderDate
                    ? `<p style="margin:0 0 12px 0; font-size:16px;">
                        Scheduled for: <strong>${new Date(reminderDate).toLocaleString()}</strong>
                      </p>`
                    : ""
                }
                <p style="margin:0; font-size:14px; color:#666;">
                  Please check your dashboard for more details or take necessary action.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:10px; background:#f4f4f4; text-align:center; font-size:12px; color:#777;">
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
