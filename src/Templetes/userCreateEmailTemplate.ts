export const userCreateEmailTemplate = (data: {
  firstname: string;
  lastname: string;
  email: string;
}) => {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8" />
    <title>Welcome to Our CRM</title>
  </head>
  <body style="font-family: Arial, sans-serif; background:#f4f4f4; padding:20px;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center">
          <table width="600" style="background:#fff; border-radius:8px; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,0.1);">
            <tr>
              <td style="background:#4CAF50; padding:20px; text-align:center; color:#fff;">
                <h1 style="margin:0; font-size:22px;">Welcome Aboard!</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:30px; text-align:left; color:#333;">
                <p style="font-size:16px;">Hello ${data.firstname} ${data.lastname},</p>
                <p style="font-size:16px;">
                  Your account has been successfully created with the email:
                  <strong>${data.email}</strong>.
                </p>
                <p style="font-size:14px; color:#666;">We’re excited to have you join us. Please log in to your account and start exploring.</p>
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
