import ClientLead, { ClientLeadCreationAttributes } from "../models/clientLead.model";
import Campaign from "../models/campaign.model";
import Order from "../models/order.model";
import { getPagination, getPagingData } from "../utils/paginate";
import { logActivity } from "./activity.service";
import { sendNotification } from "./notification.service";
import LeadActivity from "../models/leadActivity.model"; // ✅ Activity tracking
import User from "../models/user.model"; // ✅ For joining user info in activities

// ✅ Create a new client lead
export const createClientLead = async (
  leadData: ClientLeadCreationAttributes,
  userId?: number
) => {
  const lead = await ClientLead.create(leadData);

  if (userId) {
    await logActivity(userId, "Client Lead Created", `Created lead with ID ${lead.id}`);
    await sendNotification(userId, `Client lead with ID ${lead.id} created successfully.`);

    // ✅ Log into LeadActivity (polymorphic)
    await LeadActivity.create({
      entityId: lead.id,
      entityType: "clientLead",
      action: "create",
      details: `Client Lead created by user ID ${userId}`,
      performedBy: userId,
    });
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
