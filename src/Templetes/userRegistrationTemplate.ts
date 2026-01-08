export const userRegistrationTemplate = (data: {
  firstname: string;
  lastname: string;
  email: string;
}) => {
  const subject = 'Welcome to XCRM';
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.2; text-align: center; background: linear-gradient(135deg, #f8f9ff 0%, #f5f0ff 100%); padding: 12px; border-top: 3px solid #5664d2;">
      <h2 style="margin: 0 0 4px 0; font-size: 18px; font-weight: 600; color: #5664d2;">Hello ${data.firstname} ${data.lastname},</h2>
      <p style="margin: 0 0 2px 0;">Thank you for registering with <strong style="color: #5664d2;">XCRM</strong>!</p>
      <p style="margin: 0 0 2px 0;">Your account has been successfully created with the email: <strong>${data.email}</strong></p>
      <p style="margin: 4px 0 2px 0;">You can now log in to your account and start managing your leads, campaigns, and more.</p>
      <p style="margin: 4px 0 0 0; color: #5664d2;"><strong>Best regards,</strong><br/>XCRM Team</p>
    </div>
  `;
  return { subject, html };
};

