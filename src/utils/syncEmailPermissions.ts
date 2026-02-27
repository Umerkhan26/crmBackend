import EmailPermission from "../models/emailPermission.model";
import EmailTemplate from "../models/emailTemplate.model";
import { EMAIL_PERMISSIONS } from "../constants/emailPermissions";

export const syncEmailPermissionsToDB = async () => {
  for (const serviceName of EMAIL_PERMISSIONS) {
    const exists = await EmailPermission.findOne({ where: { serviceName } });

    if (!exists) {
      await EmailPermission.create({
        serviceName,
        canSend: true,
        allowedRoles: null,
      });
    }
  }

  const defaultTemplates: {
    [key: string]: { name: string; subject: string; body: string };
  } = {
    "user:create": {
      name: "User Registration Email",
      subject: "Welcome to our platform, {{firstname}}!",
      body: `Hi {{firstname}},\n\nThank you for registering. We're excited to have you on board!\n\nRegards,\nCRM Team`,
    },
    "order:create": {
      name: "Order Creation Notification",
      subject: "New Order Created for Campaign {{campaign}}",
      body: `Hello {{user}},\n\nA new order has been created under the campaign "{{campaign}}".\n\nOrder Details:\n- Leads Requested: {{lead_requested}}\n- State: {{state}}\n\nThanks,\nCRM Team`,
    },
  };

  for (const serviceName of EMAIL_PERMISSIONS) {
    const existingTemplate = await EmailTemplate.findOne({
      where: { serviceName },
    });

    if (!existingTemplate && defaultTemplates[serviceName]) {
      const { name, subject, body } = defaultTemplates[serviceName];

      await EmailTemplate.create({
        name,
        serviceName,
        subjectTemplate: subject,
        bodyTemplate: body,
      });
    }
  }

  console.log("✅ Email permissions and templates synced.");
};
