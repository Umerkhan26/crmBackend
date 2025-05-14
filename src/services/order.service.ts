import { OrderAttributes } from "../models/order.model";
import Order from "../models/order.model";
import Campaign from "../models/campaign.model";

// DTO for creating an order
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

// Function to create an order
export const createOrder = async (
  orderData: CreateOrderDTO,
  createdBy: number
): Promise<OrderAttributes> => {
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

    return order.toJSON() as OrderAttributes;
  } catch (error: any) {
    throw new Error(error.message || "Failed to create order");
  }
};

// Function to get an order by ID
export const getOrderById = async (
  id: number
): Promise<OrderAttributes | null> => {
  try {
    const order = await Order.findByPk(id);
    return order ? (order.toJSON() as OrderAttributes) : null;
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

    return order.toJSON() as OrderAttributes;
  } catch (error: any) {
    throw new Error(error.message || "Failed to update order");
  }
};

// Function to delete an order by ID
export const deleteOrderById = async (id: number): Promise<boolean> => {
  try {
    const order = await Order.findByPk(id);
    if (!order) {
      throw new Error("Order not found");
    }

    await order.destroy();
    return true;
  } catch (error: any) {
    throw new Error(error.message || "Failed to delete order");
  }
};

// Function to get all orders
export const getAllOrders = async (): Promise<OrderAttributes[]> => {
  try {
    const orders = await Order.findAll();
    return orders.map((order) => order.toJSON() as OrderAttributes);
  } catch (error: any) {
    throw new Error(error.message || "Failed to fetch orders");
  }
};
