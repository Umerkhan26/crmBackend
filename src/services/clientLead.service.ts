import ClientLead, { ClientLeadCreationAttributes } from "../models/clientLead.model";
import Campaign from "../models/campaign.model";
import Order from "../models/order.model";
import { getPagination, getPagingData } from "../utils/paginate";
import { logActivity } from "./activity.service";
import { sendNotification } from "./notification.service";
import LeadActivity from "../models/leadActivity.model"; // ✅ Activity tracking
import User from "../models/user.model"; // ✅ For joining user info in activities
import { sendEmail } from "../utils/email";

// ✅ Create a new client lead
// export const createClientLead = async (
//   leadData: ClientLeadCreationAttributes,
//   userId?: number
// ) => {
//   const lead = await ClientLead.create(leadData);

//   if (userId) {
//     await logActivity(userId, "Client Lead Created", `Created lead with ID ${lead.id}`);
//     await sendNotification(userId, `Client lead with ID ${lead.id} created successfully.`);

//     // ✅ Log into LeadActivity (polymorphic)
//     await LeadActivity.create({
//       entityId: lead.id,
//       entityType: "clientLead",
//       action: "create",
//       details: `Client Lead created by user ID ${userId}`,
//       performedBy: userId,
//     });
//   }

//   return lead;
// };





export const createClientLead = async (
  leadData: ClientLeadCreationAttributes,
  userId?: number
) => {
  console.log("👉 Incoming leadData:", JSON.stringify(leadData, null, 2));
  console.log("👉 Incoming userId:", userId);

  // 1️⃣ Create Lead in DB
  const lead = await ClientLead.create(leadData);
  console.log("✅ Lead created in DB with ID:", lead.id);

  // 2️⃣ Log + Notify + LeadActivity if user exists
  if (userId) {
    console.log("📌 Logging activity & notification for user:", userId);

    await logActivity(userId, "Client Lead Created", `Created lead with ID ${lead.id}`);
    await sendNotification(userId, `Client lead with ID ${lead.id} created successfully.`);

    await LeadActivity.create({
      entityId: lead.id,
      entityType: "clientLead",
      action: "create",
      details: `Client Lead created by user ID ${userId}`,
      performedBy: userId,
    });

    console.log("✅ LeadActivity record created");
  } else {
    console.warn("⚠️ No userId provided → skipping activity log/notification");
  }

  // 3️⃣ Send email if leadData has email field
  if (leadData.leadData && leadData.leadData.email) {
    console.log("📧 Preparing to send email to:", leadData.leadData.email);

    const smtpConfig = {
      host: process.env.DEFAULT_SMTP_HOST!,       // e.g. smtp.gmail.com
      port: Number(process.env.DEFAULT_SMTP_PORT!), // e.g. 587
      user: process.env.DEFAULT_SMTP_EMAIL!,      // your Gmail
      pass: process.env.DEFAULT_SMTP_PASSWORD!,   // Gmail App Password
    };

    console.log("🔧 SMTP Config (sanitized):", {
      host: smtpConfig.host,
      port: smtpConfig.port,
      user: smtpConfig.user,
      // ❌ Do not log password for security
    });

    try {
      await sendEmail({
        smtp: smtpConfig,
        to: leadData.leadData.email,
        subject: "New Lead Assigned",
        body: `You have been assigned ${lead.id ? `lead ID ${lead.id}` : "a new lead"}.`,
      });
      console.log("✅ Email sent successfully to:", leadData.leadData.email);
    } catch (err: any) {
      console.error("❌ Error sending email:", err.message, err.stack);
    }
  } else {
    console.warn("⚠️ No email found in leadData → skipping email notification");
  }

  return lead;
};



// ✅ Get all leads by order ID
export const getClientLeadsByOrderId = async (orderId: number) => {
  const leads = await ClientLead.findAll({
    where: { order_id: orderId },
    include: [
      { model: Campaign, as: "campaign" },
      { model: Order, as: "order" },
    ],
  });
  return leads;
};

// ✅ Get a single lead by ID
export const getClientLeadById = async (id: number) => {
  const lead = await ClientLead.findByPk(id, {
    include: [
      { model: Campaign, as: "campaign" },
      { model: Order, as: "order" },
    ],
  });
  return lead;
};

// ✅ Get paginated leads
export const getAllClientLeads = async (page = 1, limit = 10) => {
  const { offset } = getPagination({ page, limit });

  const data = await ClientLead.findAndCountAll({
    offset,
    limit,
    include: [
      { model: Campaign, as: "campaign" },
      { model: Order, as: "order" },
    ],
    order: [["createdAt", "DESC"]],
  });

  return getPagingData(data, page, limit);
};

// ✅ Update a client lead by ID
export const updateClientLeadById = async (
  id: number,
  updateData: Partial<ClientLeadCreationAttributes>,
  userId?: number
) => {
  const lead = await ClientLead.findByPk(id);
  if (!lead) throw new Error("Client lead not found");

  await lead.update(updateData);

  if (userId) {
    await logActivity(userId, "Client Lead Updated", `Updated lead with ID ${lead.id}`);
    await sendNotification(userId, `Client lead with ID ${lead.id} has been updated.`);

    // ✅ Log activity
    await LeadActivity.create({
      entityId: lead.id,
      entityType: "clientLead",
      action: "update",
      details: `Client Lead updated by user ID ${userId}`,
      performedBy: userId,
    });
  }

  return lead;
};

// ✅ Delete a client lead by ID
export const deleteClientLeadById = async (
  id: number,
  userId?: number
) => {
  const lead = await ClientLead.findByPk(id);
  if (!lead) throw new Error("Client lead not found");

  await lead.destroy();

  if (userId) {
    await logActivity(userId, "Client Lead Deleted", `Deleted lead with ID ${id}`);
    await sendNotification(userId, `Client lead with ID ${id} has been deleted.`);

    // ✅ Log activity
    await LeadActivity.create({
      entityId: id,
      entityType: "clientLead",
      action: "delete",
      details: `Client Lead deleted by user ID ${userId}`,
      performedBy: userId,
    });
  }

  return { message: "Client lead deleted successfully" };
};

// ✅ Accept or Reject a client lead (status update)
export const updateClientLeadStatus = async (
  id: number,
  status: "accepted" | "rejected",
  userId?: number
) => {
  const lead = await ClientLead.findByPk(id);
  if (!lead) throw new Error("Client lead not found");

  await lead.update({ status });

  if (userId) {
    await logActivity(userId, `Lead ${status}`, `Marked lead ID ${id} as ${status}`);
    await sendNotification(userId, `Client lead ID ${id} has been ${status}.`);

    // ✅ Log activity
    await LeadActivity.create({
      entityId: lead.id,
      entityType: "clientLead",
      action: status,
      details: `Client Lead marked as ${status} by user ID ${userId}`,
      performedBy: userId,
    });
  }

  return { message: `Client lead ${status} successfully`, lead };
};

// ✅ Get activity history of a client lead
export const getClientLeadActivities = async (clientLeadId: number) => {
  const activities = await LeadActivity.findAll({
    where: { entityId: clientLeadId, entityType: "clientLead" },
    include: [
      {
        model: User,
        as: "performedByUser",
        attributes: ["id", "firstname", "lastname", "email"],
      },
    ],
    order: [["createdAt", "DESC"]],
  });

  return activities;
};



import EmailTemplate from "../models/emailTemplate.model";
import { getSmtpConfig } from "../utils/getSmtpConfig";
import { logEmailStatus } from "./emailLog.service";
import { logLeadActivity } from "../utils/logLeadActivity";


// ✅ Send email to ClientLead using template
export const sendEmailToClientLeadUsingTemplate = async (
  clientLeadId: number,
  templateKey: string,
  senderUserId: number
) => {
  console.log("🔍 Fetching clientLead with ID:", clientLeadId);

  try {
    // 1️⃣ Find the client lead
    const lead = await ClientLead.findByPk(clientLeadId);
    console.log("✅ ClientLead query result:", lead);

    if (!lead) {
      console.log("❌ ClientLead not found in database");
      throw new Error("ClientLead not found");
    }

    console.log("📋 ClientLead found:", lead.toJSON());

    // 2️⃣ Parse leadData
    let leadData;
    if (typeof lead.leadData === "string") {
      try {
        leadData = JSON.parse(lead.leadData);
        console.log("📝 Parsed leadData:", leadData);
      } catch (error: any) {
        console.error("❌ Error parsing leadData:", error);
        throw new Error("Invalid leadData format");
      }
    } else {
      leadData = lead.leadData;
      console.log("📝 leadData (already object):", leadData);
    }

    const email = leadData?.email;
    console.log("📧 Extracted email:", email);

    if (!email) {
      throw new Error("ClientLead email not found in leadData");
    }

    // 3️⃣ Sender info
    const sender = await User.findByPk(senderUserId);
    const senderRole = String(sender?.role || "guest");
    console.log("👤 Sender:", sender?.id, "Role:", senderRole);

    // 4️⃣ Template
    const template = await EmailTemplate.findOne({
      where: { serviceName: templateKey },
    });
    console.log("📧 Template found:", template ? template.serviceName : "None");

    if (!template) throw new Error("Email template not found");

    const filledSubject = fillTemplate(template.subjectTemplate, leadData);
    const filledBody = fillTemplate(template.bodyTemplate, leadData);
    console.log("📨 Email subject:", filledSubject);

    // 5️⃣ SMTP Config
    const smtpRaw = await getSmtpConfig(senderUserId);
    const smtp = {
      host: smtpRaw.host || "",
      port: smtpRaw.port || 587,
      user: smtpRaw.user || "",
      pass: smtpRaw.pass || "",
    };
    console.log("🔧 SMTP config:", {
      ...smtp,
      pass: smtp.pass ? "***" : "empty",
    });

    if (!smtp.host || !smtp.user || !smtp.pass) {
      throw new Error("SMTP configuration is incomplete.");
    }

    // 6️⃣ Send Email
    await sendEmail({
      smtp,
      to: email,
      subject: filledSubject,
      body: filledBody,
    });

    // 7️⃣ Log email status
    await logEmailStatus({
      clientLeadId,
      to: email,
      subject: filledSubject,
      body: filledBody,
      templateUsed: templateKey,
      sentBy: senderUserId,
      sentAt: new Date(),
      status: "sent",
    });

    // 8️⃣ Log activity
    await logLeadActivity({
      entityId: clientLeadId,
      entityType: "clientLead",
      action: "email_sent",
      performedBy: senderUserId,
      details: `Email sent using template "${templateKey}" to ${email}`,
    });

    console.log("✅ Email sent successfully to:", email);
    return { message: "Email sent successfully", to: email };
  } catch (error) {
    console.error("💥 Error in sendEmailToClientLeadUsingTemplate:", error);
    throw error;
  }
};

// ✅ Helper: replace {{key}} in text with values from leadData
function fillTemplate(template: string, data: any): string {
  return template.replace(/{{(.*?)}}/g, (_, key) => {
    const trimmedKey = key.trim();
    return data?.[trimmedKey] || "";
  });
}
