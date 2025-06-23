import { OrderCreationAttributes } from "../models/order.model";

/**
 * Maps a raw row from Excel to the Order model format.
 */
export const mapOrderRow = (row: any): Partial<OrderCreationAttributes> => {
  return {
    agent: row["Agent"] || "",
    campaign_id: Number(row["Campaign ID"]),
    state: row["State"] || "",
    priority_level: (row["Priority"] || "Low") as OrderCreationAttributes["priority_level"],
    age_range: row["Age Range"] || "",
    lead_requested: row["Lead Requested"]?.toString().toLowerCase() === "yes" ? 1 : 0, // ✅ Fixed here
    fb_link: row["FB Link"] || "",
    notes: row["Notes"] || "",
    area_to_use: row["Area To Use"] || "",
    order_datetime: new Date(row["Order Date"]),
  };
};
