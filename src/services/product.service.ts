import { Op } from "sequelize";
import ProductSale, {
  ProductSaleAttributes,
  ProductSaleCreationAttributes,
} from "../models/product.model";
import Lead from "../models/lead.model";
import User from "../models/user.model";
import { getPagination, getPagingData } from "../utils/paginate";
import { logActivity } from "./activity.service";
import { sendNotification } from "./notification.service";

interface PaginationParams {
  page?: number;
  limit?: number;
}

interface SaleQueryParams extends PaginationParams {
  search?: string;
  filters?: Record<string, any>;
}

// ✅ Convert Lead to Product Sale
export const convertLeadToSale = async (
  data: ProductSaleCreationAttributes,
  userId?: number
): Promise<any> => {
  try {
    const { leadId } = data;

    const lead = await Lead.findByPk(leadId);
    if (!lead) throw new Error("Lead not found");

    const existingSale = await ProductSale.findOne({ where: { leadId } });
    if (existingSale) throw new Error("Lead is already converted to a sale");

    const sale = await ProductSale.create({
      ...data,
      status: "converted",
      conversionDate: new Date(),
    });

    if (userId) {
      await logActivity(userId, "convert", `Lead ${leadId} converted to sale`);
      await sendNotification(userId, `Lead ${leadId} has been converted to a sale`);
    }

    return sale.get();
  } catch (error: any) {
    throw new Error(`Error converting lead to sale: ${error.message}`);
  }
};

// ✅ Get All Sales with Filters, Pagination, and Search
export const getAllSales = async ({
  page = 1,
  limit = 10,
  filters = {},
  search = "",
}: SaleQueryParams) => {
  try {
    const { offset, limit: pageLimit } = getPagination({ page, limit });

    const where: any = { ...filters };

    if (search) {
      where[Op.or] = [
        { productType: { [Op.like]: `%${search}%` } },
        { notes: { [Op.like]: `%${search}%` } },
        { status: { [Op.like]: `%${search}%` } },
      ];
    }

    const data = await ProductSale.findAndCountAll({
      offset,
      limit: pageLimit,
      where,
      include: [
        {
          model: Lead,
          attributes: ["id", "campaignName", "leadData"],
        },
        {
          model: User,
          attributes: ["id", "firstname", "email"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    return getPagingData(data, page, pageLimit);
  } catch (error: any) {
    throw new Error(`Error fetching sales: ${error.message}`);
  }
};

// ✅ Get Sale by ID
export const getSaleById = async (id: number): Promise<ProductSaleAttributes> => {
  try {
    const sale = await ProductSale.findByPk(id, {
      include: [
        {
          model: Lead,
          attributes: ["id", "campaignName", "leadData"],
        },
        {
          model: User,
          attributes: ["id", "firstname", "email"],
        },
      ],
    });

    if (!sale) throw new Error("Sale not found");

    return sale.get();
  } catch (error: any) {
    throw new Error(`Error fetching sale: ${error.message}`);
  }
};

// ✅ Update Sale
export const updateSale = async (
  id: number,
  updatedData: Partial<ProductSaleAttributes>,
  userId?: number
): Promise<ProductSaleAttributes> => {
  try {
    const sale = await ProductSale.findByPk(id);
    if (!sale) throw new Error("Sale not found");

    await sale.update({
      ...updatedData,
      status: updatedData.status || sale.status, // ensure status is not lost
    });

    if (userId) {
      await logActivity(userId, "update", `Sale updated with ID ${id}`);
      await sendNotification(userId, `Sale updated with ID ${id}`);
    }

    return sale.get();
  } catch (error: any) {
    throw new Error(`Error updating sale: ${error.message}`);
  }
};

// ✅ Delete Sale
export const deleteSale = async (
  id: number,
  userId?: number
): Promise<void> => {
  try {
    const sale = await ProductSale.findByPk(id);
    if (!sale) throw new Error("Sale not found");

    await sale.destroy();

    if (userId) {
      await logActivity(userId, "delete", `Sale deleted with ID ${id}`);
      await sendNotification(userId, `Sale deleted with ID ${id}`);
    }
  } catch (error: any) {
    throw new Error(`Error deleting sale: ${error.message}`);
  }
};

// ✅ Get Sales by Product Type
export const getSalesByProductType = async (
  productType: string
): Promise<ProductSaleAttributes[]> => {
  try {
    const sales = await ProductSale.findAll({ where: { productType } });
    return sales.map((s) => s.get());
  } catch (error: any) {
    throw new Error(`Error fetching sales by product type: ${error.message}`);
  }
};
  