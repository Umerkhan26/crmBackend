export const orderCreationTemplate = (data: {
  user: string;
  agent: string;
  campaign: string;
  state: string;
  priority: string;
  lead_requested: number;
  orderId?: number;
}) => {
  const subject = 'New Order Created';
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.2; text-align: center; background: linear-gradient(135deg, #f8f9ff 0%, #f5f0ff 100%); padding: 12px; border-top: 3px solid #5664d2;">
      <h2 style="margin: 0 0 4px 0; font-size: 18px; font-weight: 600; color: #5664d2;">Hello ${data.user},</h2>
      <p style="margin: 0 0 2px 0;">A new order has been successfully created in the system.</p>
      <p style="margin: 0 0 2px 0;"><strong>Campaign:</strong> ${data.campaign}</p>
      <p style="margin: 0 0 2px 0;"><strong>Agent:</strong> ${data.agent}</p>
      <p style="margin: 0 0 2px 0;"><strong>State:</strong> ${data.state}</p>
      <p style="margin: 0 0 2px 0;"><strong>Priority:</strong> ${data.priority}</p>
      <p style="margin: 0 0 2px 0;"><strong>Leads Requested:</strong> ${data.lead_requested}</p>
      ${data.orderId ? `<p style="margin: 0 0 2px 0;"><strong>Order ID:</strong> #${data.orderId}</p>` : ''}
      <p style="margin: 4px 0 2px 0;">You can view and manage this order from your dashboard.</p>
      <p style="margin: 4px 0 0 0; color: #5664d2;"><strong>Best regards,</strong><br/>XCRM Team</p>
    </div>
  `;
  return { subject, html };
};

