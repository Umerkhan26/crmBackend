export const reminderEmailTemplate = (reminderTitle?: string, reminderDate?: string) => {
  const formattedDate = reminderDate 
    ? new Date(reminderDate).toLocaleString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : null;

  const subject = 'XCRM Reminder Notification';
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.2; text-align: center; background: linear-gradient(135deg, #fff5e6 0%, #ffe6cc 100%); padding: 12px; border-top: 3px solid #ff9800;">
      <h2 style="margin: 0 0 4px 0; font-size: 18px; font-weight: 600; color: #ff9800;">Hello,</h2>
      <p style="margin: 0 0 2px 0;">This is a friendly reminder for your scheduled task.</p>
      <p style="margin: 0 0 2px 0;"><strong>Reminder:</strong> ${reminderTitle || "Scheduled Task"}</p>
      ${formattedDate ? `<p style="margin: 0 0 2px 0;"><strong>Scheduled:</strong> ${formattedDate}</p>` : ''}
      <p style="margin: 4px 0 2px 0;">Please check your dashboard for more details or take necessary action.</p>
      <p style="margin: 4px 0 0 0; color: #ff9800;"><strong>Best regards,</strong><br/>XCRM Team</p>
    </div>
  `;
  return { subject, html };
};
