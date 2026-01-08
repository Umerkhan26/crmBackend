import User from "../models/user.model";
import { sendEmail } from "../utils/email";
import { baseEmailTemplate } from "../Templetes/baseEmailTemplate";
import { getSmtpConfig } from "../utils/getSmtpConfig";

interface SendCustomEmailParams {
  recipientUserId: number;
  subject: string;
  body: string;
  adminUserId: number;
}

export const sendCustomEmailService = async ({
  recipientUserId,
  subject,
  body,
  adminUserId,
}: SendCustomEmailParams) => {
  try {
    // Fetch recipient user
    const recipient = await User.findByPk(recipientUserId);
    if (!recipient) {
      throw new Error("Recipient user not found");
    }

    if (!recipient.email) {
      throw new Error("Recipient user does not have an email address");
    }

    // Get admin's SMTP configuration
    const smtpConfig = await getSmtpConfig(adminUserId);

    // Use baseEmailTemplate to wrap the admin's body content
    const htmlContent = baseEmailTemplate({
      title: subject,
      content: body,
    });

    // Send email (htmlContent is already HTML from baseEmailTemplate)
    await sendEmail({
      smtp: smtpConfig,
      to: recipient.email,
      subject: subject,
      body: htmlContent, // Already HTML, sendEmail will handle it
    });

    return {
      success: true,
      message: "Email sent successfully",
      recipientEmail: recipient.email,
    };
  } catch (error: any) {
    throw new Error(error.message || "Failed to send custom email");
  }
};

