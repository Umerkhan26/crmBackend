import { OrderAttributes } from "../models/order.model";
import Order from "../models/order.model";
import Campaign from "../models/campaign.model";
import { getPagination, getPagingData } from "../utils/paginate";
import ClientLead from "../models/clientLead.model";
import { Sequelize } from "sequelize";
import { sendNotification } from "./notification.service";
import { logActivity } from "./activity.service";
import { checkEmailPermission } from "./email.service";
import { getCompiledTemplate } from "./template.service";
import { emailQueue } from "../queue/emailQueue";
import { getSmtpConfig } from "../utils/getSmtpConfig";
import User from "../models/user.model";

export interface CreateOrderDTO {
  agent: string;
  campaign_id: number;
  state: string;
  priority_level: "High" | "Medium" | "Low" | "Gold Agent";
  age_range: string;
  lead_requested: number;
  fb_link?: string;
  notes?: string;
  area_to_use?: string;
  order_datetime: Date;
  assign_to_client?: {
    id: number;
    name: string;
  };
  assign_to_vendor?: {
    id: number;
    name: string;
  };
}

export const createOrder = async (
  orderData: CreateOrderDTO,
  createdBy: number
): Promise<any> => {
  try {
    const campaign = await Campaign.findByPk(orderData.campaign_id);
    if (!campaign) {
      console.error("❌ Campaign not found:", orderData.campaign_id);
      throw new Error("Campaign not found");
    }

    const order = await Order.create({
      agent: orderData.agent,
      campaign_id: orderData.campaign_id,
      state: orderData.state,
      priority_level: orderData.priority_level,
      age_range: orderData.age_range,
      lead_requested: orderData.lead_requested,
      fb_link: orderData.fb_link,
      notes: orderData.notes,
      area_to_use: orderData.area_to_use,
      order_datetime: orderData.order_datetime,
      created_by: createdBy,
      assign_to_client: orderData.assign_to_client,
      assign_to_vendor: orderData.assign_to_vendor,
    });

    console.log("✅ Order created:", order.id);

    await sendNotification(createdBy, `New order created for campaign "${campaign.campaignName}"`);
    await logActivity(createdBy, "Order Created", `Order ID: ${order.id}`);

    // ✅ Email functionality
    const user = await User.findByPk(createdBy);
    if (!user) {
      console.warn("⚠️ User not found for ID:", createdBy);
    } else {
      console.log("👤 Email check for user:", user.email, "Role:", user.userrole);

      const canSendEmail = await checkEmailPermission("order:create", user.userrole || "client");
      console.log("📩 Email permission check:", canSendEmail);

      if (canSendEmail) {
        const smtpConfig = await getSmtpConfig(createdBy);
        console.log("📨 SMTP config loaded:", smtpConfig);

        const { subject, body } = await getCompiledTemplate("order:create", {
          agent: order.agent,
          campaign: campaign.campaignName,
          state: order.state,
          priority: order.priority_level,
          lead_requested: order.lead_requested,
          user: `${user.firstname} ${user.lastname}`,
        });

        console.log("✉️ Compiled Email Subject:", subject);
        console.log("📄 Compiled Email Body:", body);

        await emailQueue.add("order:create", {
          to: user.email,
          subject,
          body,
          smtpConfig,
          serviceName: "order:create",
        });

        console.log("✅ Email queued to:", user.email);
      } else {
        console.log("❌ Email not allowed for role:", user.userrole);
      }
    }

    const orderWithCampaign = await Order.findByPk(order.id, {
      include: [{ model: Campaign, as: "campaign" }],
    });

    return orderWithCampaign?.toJSON();
  } catch (error: any) {
    console.error("❌ Error in createOrder:", error.message || error);
    throw new Error(error.message || "Failed to create order");
  }
};




export const getOrderById = async (
  id: number
): Promise<OrderAttributes & { campaign?: any } | null> => {
  try {
    const order = await Order.findByPk(id, {
      include: [
        {
          model: Campaign,
          as: "campaign", // This should match the alias used in your model association
        },
      ],
    });

    if (!order) return null;

    const orderJson = order.toJSON() as OrderAttributes & { campaign?: any };

    return orderJson;
  } catch (error: any) {
    throw new Error(error.message || "Failed to fetch order by ID");
  }
};

// Function to update an order by ID
export const updateOrderById = async (
  id: number,
  updatedData: Partial<CreateOrderDTO>,
  updatedBy: number
): Promise<OrderAttributes | null> => {
  try {
    const order = await Order.findByPk(id);
    if (!order) {
      throw new Error("Order not found");
    }

    await order.update({
      ...updatedData,
      updated_at: new Date(),
      created_by: updatedBy,
    });

    // 🔔 Notify and 📝 Log
    await sendNotification(updatedBy, `Order ID ${id} updated.`);
    await logActivity(updatedBy, "Order Updated", `Order ID: ${id}`);

    return order.toJSON() as OrderAttributes;
  } catch (error: any) {
    throw new Error(error.message || "Failed to update order");
  }
};


// Function to delete an order by ID
export const deleteOrderById = async (id: number, deletedBy: number): Promise<boolean> => {
  try {
    const order = await Order.findByPk(id);
    if (!order) {
      throw new Error("Order not found");
    }

    await order.destroy();

    // 🔔 Notify and 📝 Log
    await sendNotification(deletedBy, `Order ID ${id} has been deleted.`);
    await logActivity(deletedBy, "Order Deleted", `Order ID: ${id}`);

    return true;
  } catch (error: any) {
    throw new Error(error.message || "Failed to delete order");
  }
};


export const getAllOrders = async (
  page: number = 1,
  limit: number = 10
): Promise<ReturnType<typeof getPagingData>> => {
  try {
    const { offset, limit: pageLimit } = getPagination({ page, limit });

    // Fetch orders
    const result = await Order.findAndCountAll({
      offset,
      limit: pageLimit,
      include: [
        {
          model: Campaign,
          as: "campaign",
        },
      ],
      order: [["created_at", "DESC"]],
    });

    const orderIds = result.rows.map((order) => order.id);

    // Fetch lead counts grouped by order_id
    const leadCounts = await ClientLead.findAll({
      attributes: [
        "order_id",
        [Sequelize.fn("COUNT", Sequelize.col("id")), "leadCount"],
      ],
      where: {
        order_id: orderIds,
      },
      group: ["order_id"],
      raw: true,
    });

    // Convert to map
    const leadCountMap = leadCounts.reduce((acc, curr) => {
      const orderId = curr.order_id as number;
      const leadCount = parseInt((curr as any).leadCount); // ✅ Fix 2: Cast to any
      acc[orderId] = leadCount;
      return acc;
    }, {} as Record<number, number>);

    // Append remainingLeads to each order
    const rowsWithRemainingLeads = result.rows.map((order) => {
      const orderJson = order.toJSON() as OrderAttributes & { campaign?: any };
      const usedLeads = leadCountMap[order.id] || 0;
      const remainingLeads = Math.max(0, (orderJson.lead_requested || 0) - usedLeads);

      return {
        ...orderJson,
        remainingLeads,
      };
    });

    return getPagingData(
      { count: result.count, rows: rowsWithRemainingLeads },
      page,
      pageLimit
    );
  } catch (error: any) {
    throw new Error(error.message || "Failed to fetch paginated orders");
  }
};

export const setOrderBlockStatus = async (
  id: number,
  blockStatus: boolean,
  userId: number
): Promise<OrderAttributes | null> => {
  try {
    const order = await Order.findByPk(id);
    if (!order) {
      throw new Error("Order not found");
    }

    await order.update({ is_blocked: blockStatus });

    // 🔔 Notify and 📝 Log
    await sendNotification(userId, `Order ID ${id} has been ${blockStatus ? "blocked" : "unblocked"}.`);
    await logActivity(userId, "Order Block Status Changed", `Order ID: ${id}`);

    return order.toJSON() as OrderAttributes;
  } catch (error: any) {
    throw new Error(error.message || "Failed to update block status");
  }
};
