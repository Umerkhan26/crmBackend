import ClientLead, { ClientLeadCreationAttributes } from "../models/clientLead.model";
import Campaign from "../models/campaign.model";
import Order from "../models/order.model";
import { getPagination, getPagingData } from "../utils/paginate";
import { logActivity } from "./activity.service";
import { sendNotification } from "./notification.service";
import LeadActivity from "../models/leadActivity.model";
import User from "../models/user.model";
import { sendEmail } from "../utils/email";
import { leadAssignmentTemplate } from "../Templetes/leadAssignmentTemplate";


export const createClientLead = async (
  leadData: ClientLeadCreationAttributes,
  userId?: number
) => {


  const lead = await ClientLead.create(leadData);

  if (userId) {

    await logActivity(userId, "Client Lead Created", `Created lead with ID ${lead.id}`);
    await sendNotification(userId, `Client lead with ID ${lead.id} created successfully.`);

    await LeadActivity.create({
      entityId: lead.id,
      entityType: "clientLead",
      action: "create",
      details: `Client Lead created by user ID ${userId}`,
      performedBy: userId,
    });

  } else {
  }

  if (leadData.leadData && leadData.leadData.email) {

    const smtpConfig = {
      host: process.env.DEFAULT_SMTP_HOST!,
      port: Number(process.env.DEFAULT_SMTP_PORT!),
      user: process.env.DEFAULT_SMTP_EMAIL!,
      pass: process.env.DEFAULT_SMTP_PASSWORD!,
    };

    try {
      const { subject, html } = leadAssignmentTemplate({
        userName: leadData.leadData.first_name || "User",
        leadCode: `CL-${lead.id}`,
        campaignName: leadData.leadData.campaignName,
      });

      await sendEmail({
        smtp: smtpConfig,
        to: leadData.leadData.email,
        subject,
        body: html,
      });
    } catch (err: any) {
      console.error("Error sending client lead assignment email:", err);
    }
  } else {
  }

  return lead;
};



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

export const getClientLeadById = async (id: number) => {
  const lead = await ClientLead.findByPk(id, {
    include: [
      { model: Campaign, as: "campaign" },
      { model: Order, as: "order" },
    ],
  });
  return lead;
};

export const getAllClientLeads = async (
  page = 1,
  limit = 10,
  filters: { orderId?: number; status?: string; search?: string } = {}
) => {
  const { offset } = getPagination({ page, limit });
  const whereClause: any = {};
  if (filters.orderId) {
    whereClause.order_id = filters.orderId;
  }
  if (filters.status && filters.status !== "all") {
    whereClause.status = filters.status;
  }
  if (filters.search) {
    whereClause.leadData = {
      [Op.or]: [
        { agent_name: { [Op.like]: `%${filters.search}%` } },
        { first_name: { [Op.like]: `%${filters.search}%` } },
        { last_name: { [Op.like]: `%${filters.search}%` } },
        { state: { [Op.like]: `%${filters.search}%` } },
        { phone_number: { [Op.like]: `%${filters.search}%` } },
      ],
    };
  }
  const data = await ClientLead.findAndCountAll({
    where: whereClause,
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
import { newLeadEmailTemplate } from "../Templetes/newLeadEmail";
import { Op } from "sequelize";


export const sendEmailToClientLeadUsingTemplate = async (
  clientLeadId: number,
  templateKey: string,
  senderUserId: number
) => {

  try {
    const lead = await ClientLead.findByPk(clientLeadId);

    if (!lead) {
      throw new Error("ClientLead not found");
    }


    let leadData;
    if (typeof lead.leadData === "string") {
      try {
        leadData = JSON.parse(lead.leadData);
      } catch (error: any) {
        throw new Error("Invalid leadData format");
      }
    } else {
      leadData = lead.leadData;
    }

    const email = leadData?.email;

    if (!email) {
      throw new Error("ClientLead email not found in leadData");
    }

    const sender = await User.findByPk(senderUserId);
    const senderRole = String(sender?.role || "guest");

    const template = await EmailTemplate.findOne({
      where: { serviceName: templateKey },
    });

    if (!template) throw new Error("Email template not found");

    const filledSubject = fillTemplate(template.subjectTemplate, leadData);
    const filledBody = fillTemplate(template.bodyTemplate, leadData);

    const smtpRaw = await getSmtpConfig(senderUserId);
    const smtp = {
      host: smtpRaw.host || "",
      port: smtpRaw.port || 587,
      user: smtpRaw.user || "",
      pass: smtpRaw.pass || "",
    };


    if (!smtp.host || !smtp.user || !smtp.pass) {
      throw new Error("SMTP configuration is incomplete.");
    }

    await sendEmail({
      smtp,
      to: email,
      subject: filledSubject,
      body: filledBody,
    });

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

    await logLeadActivity({
      entityId: clientLeadId,
      entityType: "clientLead",
      action: "email_sent",
      performedBy: senderUserId,
      details: `Email sent using template "${templateKey}" to ${email}`,
    });

    return { message: "Email sent successfully", to: email };
  } catch (error) {
    throw error;
  }
};

function fillTemplate(template: string, data: any): string {
  return template.replace(/{{(.*?)}}/g, (_, key) => {
    const trimmedKey = key.trim();
    return data?.[trimmedKey] || "";
  });
}
