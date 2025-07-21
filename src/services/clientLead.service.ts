import ClientLead, { ClientLeadCreationAttributes } from "../models/clientLead.model";
import Campaign from "../models/campaign.model";
import Order from "../models/order.model";
import { getPagination, getPagingData } from "../utils/paginate";
import { logActivity } from "./activity.service";
import { sendNotification } from "./notification.service";

// ✅ Create a new client lead
export const createClientLead = async (
  leadData: ClientLeadCreationAttributes,
  userId?: number
) => {
  const lead = await ClientLead.create(leadData);

  if (userId) {
    await logActivity(userId, "Client Lead Created", `Created lead with ID ${lead.id}`);
    await sendNotification(userId, `Client lead with ID ${lead.id} created successfully.`);
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
  }

  return { message: `Client lead ${status} successfully`, lead };
};
