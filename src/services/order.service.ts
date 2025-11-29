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
import { buildSearchFilter } from "../utils/filterQuery";
import { Op, where, json } from "sequelize";
import { sendEmail } from "../utils/email";







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


    await sendNotification(
      createdBy,
      `New order created for campaign "${campaign.campaignName}"`
    );
    await logActivity(
      createdBy,
      "Order Created",
      `Order Created With ID: ${order.id}`
    );

    const user = await User.findByPk(createdBy);
    if (!user) {
    } else {


      const canSendEmail = await checkEmailPermission(
        "order:create",
        user.userrole || "client"
      );

      if (canSendEmail) {
        const smtpConfig = await getSmtpConfig(createdBy);

        const { subject, body } = await getCompiledTemplate("order:create", {
          agent: order.agent,
          campaign: campaign.campaignName,
          state: order.state,
          priority: order.priority_level,
          lead_requested: order.lead_requested,
          user: `${user.firstname} ${user.lastname}`,
        });




        await sendEmail({
          smtp: {
            host: user.smtpoutgoingserver || process.env.DEFAULT_SMTP_HOST || "",
            port:
              (user.smtpport ? Number(user.smtpport) : Number(process.env.DEFAULT_SMTP_PORT)) ||
              587,
            user: user.smtpemail || process.env.DEFAULT_SMTP_EMAIL || "",
            pass: user.smtppassword || process.env.DEFAULT_SMTP_PASSWORD || "",
          },
          to: user.email || "",
          subject: subject || "No Subject",
          body: body || "",
        });


      }
    }
    const orderWithCampaign = await Order.findByPk(order.id, {
      include: [{ model: Campaign, as: "campaign" }],
    });

    return orderWithCampaign?.toJSON();
  } catch (error: any) {
    throw new Error(error.message || "Failed to create order");
  }
};
export const getOrderById = async (
  id: number
): Promise<(OrderAttributes & { campaign?: any }) | null> => {
  try {
    const order = await Order.findByPk(id, {
      include: [
        {
          model: Campaign,
          as: "campaign",
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

    await sendNotification(updatedBy, `Order ID ${id} updated.`);
    await logActivity(
      updatedBy,
      "Order Updated",
      `Order Updated With ID: ${id}`
    );

    return order.toJSON() as OrderAttributes;
  } catch (error: any) {
    throw new Error(error.message || "Failed to update order");
  }
};

export const deleteOrderById = async (
  id: number,
  deletedBy: number
): Promise<boolean> => {
  try {
    const order = await Order.findByPk(id);
    if (!order) {
      throw new Error("Order not found");
    }

    await order.destroy();
    await sendNotification(deletedBy, `Order ID ${id} has been deleted.`);
    await logActivity(
      deletedBy,
      "Order Deleted",
      `Order Deleted With ID: ${id}`
    );
    return true;
  } catch (error: any) {
    throw new Error(error.message || "Failed to delete order");
  }
};

export const getAllOrders = async (
  page: number = 1,
  limit: number = 10,
  search: string = ""
): Promise<ReturnType<typeof getPagingData>> => {
  try {
    const { offset, limit: pageLimit } = getPagination({ page, limit });

    const searchFilter = buildSearchFilter(search, ["agent"]);

    const result = await Order.findAndCountAll({
      where: {
        ...searchFilter,
      },
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

    const leadCountMap = leadCounts.reduce((acc, curr) => {
      const orderId = curr.order_id as number;
      const leadCount = parseInt((curr as any).leadCount);
      acc[orderId] = leadCount;
      return acc;
    }, {} as Record<number, number>);

    const rowsWithRemainingLeads = result.rows.map((order) => {
      const orderJson = order.toJSON() as OrderAttributes & { campaign?: any };
      const usedLeads = leadCountMap[order.id] || 0;
      const remainingLeads = Math.max(
        0,
        (orderJson.lead_requested || 0) - usedLeads
      );

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

    await sendNotification(
      userId,
      `Order ID ${id} has been ${blockStatus ? "blocked" : "unblocked"}.`
    );
    await logActivity(userId, "Order Block Status Changed", `Order ID: ${id}`);

    return order.toJSON() as OrderAttributes;
  } catch (error: any) {
    throw new Error(error.message || "Failed to update block status");
  }
};

export const getOrdersByVendorId = async (
  vendorId: number,
  page: number = 1,
  limit: number = 10,
  search: string = ""
) => {
  const { offset, limit: pageLimit } = getPagination({ page, limit });

  const searchFilter = buildSearchFilter(search, ["agent"]);

  const result = await Order.findAndCountAll({
    where: {
      ...searchFilter,
      [Op.and]: [where(json("assign_to_vendor.id") as any, vendorId)],
    },
    offset,
    limit: pageLimit,
    include: [{ model: Campaign, as: "campaign" }],
    order: [["created_at", "DESC"]],
  });

  const rowsWithRemainingLeads = await attachRemainingLeads(result.rows);

  return getPagingData(
    { count: result.count, rows: rowsWithRemainingLeads },
    page,
    pageLimit
  );
};

export const getOrdersByClientId = async (
  clientId: number,
  page: number = 1,
  limit: number = 10,
  search: string = ""
) => {
  const { offset, limit: pageLimit } = getPagination({ page, limit });

  const searchFilter = buildSearchFilter(search, ["agent"]);

  const result = await Order.findAndCountAll({
    where: {
      ...searchFilter,
      [Op.and]: [where(json("assign_to_client.id") as any, clientId)],
    },
    offset,
    limit: pageLimit,
    include: [{ model: Campaign, as: "campaign" }],
    order: [["created_at", "DESC"]],
  });

  const rowsWithRemainingLeads = await attachRemainingLeads(result.rows);

  return getPagingData(
    { count: result.count, rows: rowsWithRemainingLeads },
    page,
    pageLimit
  );
};

const attachRemainingLeads = async (orders: any[]) => {
  const orderIds = orders.map((order) => order.id);

  if (orderIds.length === 0) return orders;

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

  const leadCountMap = leadCounts.reduce((acc, curr) => {
    const orderId = curr.order_id as number;
    const leadCount = parseInt((curr as any).leadCount);
    acc[orderId] = leadCount;
    return acc;
  }, {} as Record<number, number>);

  return orders.map((order) => {
    const orderJson = order.toJSON() as OrderAttributes & { campaign?: any };
    const usedLeads = leadCountMap[order.id] || 0;
    const remainingLeads = Math.max(
      0,
      (orderJson.lead_requested || 0) - usedLeads
    );
    return { ...orderJson, remainingLeads };
  });
};
