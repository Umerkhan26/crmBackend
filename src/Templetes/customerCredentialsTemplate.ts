export const customerCredentialsTemplate = (data: {
  firstname: string;
  lastname: string;
  email: string;
  password: string;
  brandName: string;
  portalUrl?: string;
}): { subject: string; html: string } => {
  const portalLink = data.portalUrl
    ? `<p><a href="${data.portalUrl}">${data.portalUrl}</a></p>`
    : "";

  return {
    subject: `Your ${data.brandName} customer portal account`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Welcome to ${data.brandName}</h2>
        <p>Hello ${data.firstname} ${data.lastname},</p>
        <p>Your customer portal account has been created. Use these details to sign in:</p>
        <ul>
          <li><strong>Email:</strong> ${data.email}</li>
          <li><strong>Password:</strong>
            <span style="font-size:18px;font-weight:bold;letter-spacing:1px;font-family:monospace;">${data.password}</span>
          </li>
        </ul>
        <p style="color:#555;font-size:13px;">This is a simple temporary password (not your account hash). Please change it after your first login.</p>
        ${portalLink}
        <p>Please change your password after your first login.</p>
        <p>Thank you,<br/>${data.brandName} Team</p>
      </div>
    `,
  };
};
