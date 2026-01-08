export const newLeadEmailTemplate = (leadId?: number) => {
  const subject = 'New Lead Assigned to You';
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.2; text-align: center; background: linear-gradient(135deg, #f8f9ff 0%, #f5f0ff 100%); padding: 12px; border-top: 3px solid #5664d2;">
      <h2 style="margin: 0 0 4px 0; font-size: 18px; font-weight: 600; color: #5664d2;">Hello,</h2>
      <p style="margin: 0 0 2px 0;">You have been assigned <strong>${leadId ? `Lead ID: ${leadId}` : "a new lead"}</strong>.</p>
      <p style="margin: 4px 0 2px 0;">Please check your dashboard for more details.</p>
      <p style="margin: 4px 0 0 0; color: #5664d2;"><strong>Best regards,</strong><br/>XCRM Team</p>
    </div>
  `;
  return { subject, html };
};
