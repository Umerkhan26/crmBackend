export const leadAssignmentTemplate = (data: {
  userName: string;
  leadCode: string;
  leadCount?: number;
  assignedBy?: string;
  campaignName?: string;
}) => {
  const isBulk = (data.leadCount || 0) > 1;
  const leadText = isBulk 
    ? `${data.leadCount} leads have been assigned to you`
    : `Lead <strong>${data.leadCode}</strong> has been assigned to you`;

  const subject = isBulk ? 'Leads Assigned to You' : 'Lead Assigned to You';
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.2; text-align: center; background: linear-gradient(135deg, #f8f9ff 0%, #f5f0ff 100%); padding: 12px; border-top: 3px solid #5664d2;">
      <h2 style="margin: 0 0 4px 0; font-size: 18px; font-weight: 600; color: #5664d2;">Hello ${data.userName},</h2>
      <p style="margin: 0 0 2px 0;">${leadText}.</p>
      ${!isBulk && data.leadCode ? `<p style="margin: 0 0 2px 0;"><strong>Lead Code:</strong> ${data.leadCode}</p>` : ''}
      ${isBulk && data.leadCount ? `<p style="margin: 0 0 2px 0;"><strong>Total Leads:</strong> ${data.leadCount}</p>` : ''}
      ${data.campaignName ? `<p style="margin: 0 0 2px 0;"><strong>Campaign:</strong> ${data.campaignName}</p>` : ''}
      ${data.assignedBy ? `<p style="margin: 0 0 2px 0;"><strong>Assigned By:</strong> ${data.assignedBy}</p>` : ''}
      <p style="margin: 4px 0 2px 0;">Please review ${isBulk ? 'these leads' : 'this lead'} in your dashboard and take necessary action.</p>
      <p style="margin: 4px 0 0 0; color: #5664d2;"><strong>Best regards,</strong><br/>XCRM Team</p>
    </div>
  `;
  return { subject, html };
};

