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
import Campaign from "../models/campaign.model";

interface PaginationParams {
  page?: number;
  limit?: number;
}

interface SaleQueryParams extends PaginationParams {
  search?: string;
  filters?: Record<string, any>;
}
 
export const convertLeadToSale = async (
  data: ProductSaleCreationAttributes,
  userId?: number
): Promise<any> => {
  try {
    const { leadId, campaignId, assigneeId, products } = data;

    const lead = await Lead.findByPk(leadId);
    if (!lead) throw new Error("Lead not found");

    const existingSale = await ProductSale.findOne({ where: { leadId } });
    if (existingSale) throw new Error("Lead is already converted to a sale");

    const sale = await ProductSale.create({
      ...data,
      products: products ?? null, // ✅ Store multiple products if given
      status: "converted",
      conversionDate: new Date(),
      createdBy: userId ?? undefined,
      campaignId,
      assigneeId,
    });

    if (userId) {
      await logActivity(userId, "convert", `Lead ${leadId} converted to sale`);
      await sendNotification(
        userId,
        `Lead ${leadId} has been converted to a sale`
      );
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
export const getSaleById = async (id: number | string) => {
  console.log("🔍 [getSaleById] Called with ID:", id);

  try {
    const numericId = Number(id);
    console.log("➡️ Parsed numeric ID:", numericId);

    if (isNaN(numericId)) {
      console.error("❌ Invalid ID provided:", id);
      throw new Error("Invalid sale ID");
    }

    console.log("📡 Querying ProductSale by PK...");
    const sale = await ProductSale.findByPk(numericId, {
      include: [
        { model: Lead, attributes: ["id", "campaignName", "leadData"] },
        { model: User, attributes: ["id", "firstname", "email"] },
      ],
    });

    console.log("📦 Sequelize query result:", sale);

    if (!sale) {
      console.warn("⚠️ Sale not found for ID:", numericId);
      throw new Error("Sale not found");
    }

    const plainSale = sale.toJSON();
    console.log("✅ Final sale object:", plainSale);

    return plainSale;
  } catch (error: any) {
    console.error("🔥 Error in getSaleById service:", error);
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
      products: updatedData.products ?? sale.products, // ✅ Keep existing if not provided
      status: updatedData.status || sale.status,
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

    // ✅ Only allow deletion if status is "converted"
    if (sale.status !== "converted") {
      throw new Error("Only converted sales can be deleted");
    }

    await sale.destroy();

    if (userId) {
      await logActivity(userId, "delete", `Converted sale deleted with ID ${id}`);
      await sendNotification(userId, `Converted sale deleted with ID ${id}`);
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

// pure crud new
export const createProduct = async (
  data: Omit<
    ProductSaleCreationAttributes,
    "leadId" | "conversionDate" | "createdBy"
  >,
  userId?: number
): Promise<ProductSaleAttributes> => {
  try {
    const product = await ProductSale.create({
      ...data,
      leadId: undefined,
      conversionDate: new Date(),
      createdBy: userId ?? undefined,
    });

    if (userId) {
      await logActivity(
        userId,
        "create",
        `Product created (Type: ${product.productType})`
      );
      await sendNotification(
        userId,
        `New product created: ${product.productType}`
      );
    }

    // If campaignId is provided, fetch the campaign with alias
    let campaignDetails = null;
    if (data.campaignId) {
      campaignDetails = await Campaign.findByPk(data.campaignId);
    }

    // Combine product with campaign if found
    const result: any = product.get();
    if (campaignDetails) {
      result.campaign = campaignDetails.get(); // attach campaign info to response
    }

    return result;
  } catch (error: any) {
    throw new Error(`Error creating product: ${error.message}`);
  }
};

// ✅ Get Product by ID
export const getProductById = async (
  id: number
): Promise<ProductSaleAttributes> => {
  const product = await ProductSale.findByPk(id);
  if (!product) throw new Error("Product not found");
  return product.get();
};

export const getAllProducts = async (
  page: number = 1,
  limit: number = 10
): Promise<any> => {
  const { offset, limit: pageLimit } = getPagination({ page, limit });

  const data = await ProductSale.findAndCountAll({
    where: {
      status: "pending", // ✅ only fetch pending products
    },
    include: [
      {
        model: Campaign,
        as: "campaign", // match alias in association
      },
    ],
    order: [["createdAt", "DESC"]],
    offset,
    limit: pageLimit,
  });

  return getPagingData(data, page, pageLimit);
};


// ✅ Update Product
export const updateProduct = async (
  id: number,
  updatedData: Partial<ProductSaleAttributes>,
  userId?: number
): Promise<ProductSaleAttributes> => {
  const product = await ProductSale.findByPk(id);
  if (!product) throw new Error("Product not found");

  await product.update(updatedData);

  if (userId) {
    await logActivity(userId, "update", `Product updated with ID ${id}`);
    await sendNotification(userId, `Product updated: ID ${id}`);
  }

  return product.get();
};

// ✅ Delete Product
export const deleteProduct = async (
  id: number,
  userId?: number
): Promise<void> => {
  const product = await ProductSale.findByPk(id);
  if (!product) throw new Error("Product not found");

  // ✅ Only allow deletion if product is pending
  if (product.status !== "pending") {
    throw new Error("Only pending products can be deleted");
  }

  await product.destroy();

  if (userId) {
    await logActivity(userId, "delete", `Pending product deleted with ID ${id}`);
    await sendNotification(userId, `Pending product deleted: ID ${id}`);
  }
};


// ✅ Get Products by campaignName and assigneeId (NEW)
// ✅ Get Products by campaignId and assigneeId
export const getProductsByCampaignAndAssignee = async (
  campaignId: number,
  assigneeId: number
): Promise<ProductSaleAttributes[]> => {
  try {
    const products = await ProductSale.findAll({
      where: {
        campaignId,
        assigneeId,
      },
      order: [["createdAt", "DESC"]],
    });

    return products.map((product) => product.get());
  } catch (error: any) {
    throw new Error(`Error fetching products: ${error.message}`);
  }
};
export const getInvoiceByLeadId = async (leadId: number) => {
  try {
    const sale: any = await ProductSale.findOne({
      where: { leadId },
      include: [
        { model: Lead, attributes: ["id", "campaignName", "leadData"] },
        {
          model: User,
          as: "assignee",
          attributes: ["id", "firstname", "email"],
        },
        { model: Campaign, as: "campaign", attributes: ["id", "campaignName"] },
      ],
    });

    if (!sale) {
      throw new Error("No sale found for this lead");
    }

    // Parse products JSON string if it exists
    let parsedProducts = [];
    try {
      if (sale.products && typeof sale.products === "string") {
        parsedProducts = JSON.parse(sale.products);
      } else if (Array.isArray(sale.products)) {
        parsedProducts = sale.products;
      } else if (sale.products === null) {
        // Fallback for single-product sales
        parsedProducts = [
          {
            productType: sale.productType || "N/A",
            price: sale.price || 0,
            notes: sale.notes || "N/A",
          },
        ];
      }
    } catch (error) {
      console.error(`Error parsing products for sale ID ${sale.id}:`, error);
      parsedProducts = [
        {
          productType: sale.productType || "N/A",
          price: sale.price || 0,
          notes: sale.notes || "N/A",
        },
      ];
    }

    // Calculate total amount from parsed products
    const totalAmount = parsedProducts.reduce(
      (sum: number, p: any) => sum + (parseFloat(p.price) || 0),
      0
    );

    return {
      invoiceNumber: `INV-${sale.id}`,
      date: sale.conversionDate,
      sale: {
        ...sale.get({ plain: true }),
        parsedProducts, // Include parsed products for frontend
      },
      lead: sale.Lead,
      assignee: sale.assignee,
      campaign: sale.campaign,
      products: parsedProducts,
      totalAmount,
      success: true,
    };
  } catch (error: any) {
    console.error(`Error in getInvoiceByLeadId for leadId ${leadId}:`, error);
    throw new Error(`Failed to fetch invoice: ${error.message}`);
  }
};

export const getSalesByAssigneeId = async (assigneeId: number | string) => {
  console.log(
    ":mag: [getSalesByAssigneeId] Called with assigneeId:",
    assigneeId
  );
  try {
    const numericId = Number(assigneeId);
    console.log(":arrow_right: Parsed numeric assigneeId:", numericId);
    if (isNaN(numericId)) {
      console.error(":x: Invalid assigneeId provided:", assigneeId);
      throw new Error("Invalid assignee ID");
    }
    console.log(":satellite_antenna: Querying ProductSale by assigneeId...");
    const sales = await ProductSale.findAll({
      where: { assigneeId: numericId },
      include: [
        { model: Lead, attributes: ["id", "campaignName", "leadData"] },
        { model: User, attributes: ["id", "firstname", "email"] },
      ],
      order: [["createdAt", "DESC"]],
    });
    console.log(":package: Sequelize query result:", sales);
    if (!sales || sales.length === 0) {
      console.warn(":warning: No sales found for assigneeId:", numericId);
      throw new Error("No sales found for this assignee");
    }

    const plainSales = sales.map((sale) => sale.toJSON());
    console.log("✅ Final sales array:", plainSales);

    return plainSales;
  } catch (error: any) {
    console.error(":fire: Error in getSalesByAssigneeId service:", error);
    throw new Error(`Error fetching sales by assigneeId: ${error.message}`);
  }
};
