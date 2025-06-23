import { parseFileBuffer } from "../utils/fileParser";
import { mapOrderRow } from "../utils/orderMapper";
import Order, { OrderCreationAttributes } from "../models/order.model";

export const importOrdersFromFile = async (fileBuffer: Buffer, createdBy: number) => {
  const rows = parseFileBuffer(fileBuffer);

  const validOrders: OrderCreationAttributes[] = [];
  const skippedRows: { row: number; reason: string }[] = [];

  for (let [index, row] of rows.entries()) {
    try {
      const order = mapOrderRow(row);

      // ✅ Strict check before asserting full type
      if (
        !order.agent ||
        !order.campaign_id ||
        !order.state ||
        !order.priority_level ||
        !order.age_range ||
        !order.lead_requested ||
        !order.order_datetime
      ) {
        throw new Error("Missing required fields");
      }

      validOrders.push({
        ...order,
        created_by: createdBy,
      } as OrderCreationAttributes); // ✅ Type assertion only after checks
    } catch (err: any) {
      skippedRows.push({ row: index + 2, reason: err.message });
    }
  }

  if (validOrders.length > 0) {
    await Order.bulkCreate(validOrders);
  }

  return {
    imported: validOrders.length,
    skipped: skippedRows,
  };
};
