import { Op, Sequelize } from "sequelize";
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
      products: products ?? null,
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
export const getAllSales = async ({
  page = 1,
  limit = 10,
  filters = {},
  search = "",
}: SaleQueryParams) => {
  try {
    const { offset, limit: pageLimit } = getPagination({ page, limit });
    const where: any = { ...filters };
    const include: any = [
      {
        model: Lead,
        attributes: ["id", "campaignName", "leadData"],
      },
      {
        model: User,
        attributes: ["id", "firstname", "email"],
      },
    ];
    if (search) {
      where[Op.or] = [
        { productType: { [Op.like]: `%${search}%` } },
        { price: { [Op.like]: `%${search}%` } },
        { notes: { [Op.like]: `%${search}%` } },
        { status: { [Op.like]: `%${search}%` } },
        { "$Lead.campaignName$": { [Op.like]: `%${search}%` } },
        { "$User.firstname$": { [Op.like]: `%${search}%` } },
        { "$User.email$": { [Op.like]: `%${search}%` } },
        Sequelize.literal(
          `JSON_UNQUOTE(JSON_EXTRACT(Lead.leadData, '$.first_name')) LIKE '%${search}%'`
        ),
        Sequelize.literal(
          `JSON_UNQUOTE(JSON_EXTRACT(Lead.leadData, '$.last_name')) LIKE '%${search}%'`
        ),
        Sequelize.literal(
          `JSON_UNQUOTE(JSON_EXTRACT(Lead.leadData, '$.agent_name')) LIKE '%${search}%'`
        ),
        Sequelize.literal(
          `JSON_UNQUOTE(JSON_EXTRACT(Lead.leadData, '$.state')) LIKE '%${search}%'`
        ),
        Sequelize.literal(
          `JSON_UNQUOTE(JSON_EXTRACT(Lead.leadData, '$.email')) LIKE '%${search}%'`
        ),
        Sequelize.where(
          Sequelize.fn(
            "DATE_FORMAT",
            Sequelize.col("ProductSale.conversionDate"),
            "%Y-%m-%d"
          ),
          { [Op.like]: `%${search}%` }
        ),
      ];
    }
    const data = await ProductSale.findAndCountAll({
      offset,
      limit: pageLimit,
      where,
      include,
      order: [["createdAt", "DESC"]],
    });
    return getPagingData(data, page, pageLimit);
  } catch (error: any) {
    throw new Error(`Error fetching sales: ${error.message}`);
  }
};

export const getSaleById = async (id: number | string) => {

  try {
    const numericId = Number(id);

    if (isNaN(numericId)) {
      throw new Error("Invalid sale ID");
    }

    const sale = await ProductSale.findByPk(numericId, {
      include: [
        { model: Lead, attributes: ["id", "campaignName", "leadData"] },
        { model: User, attributes: ["id", "firstname", "email"] },
      ],
    });


    if (!sale) {
      throw new Error("Sale not found");
    }

    const plainSale = sale.toJSON();

    return plainSale;
  } catch (error: any) {
    throw new Error(`Error fetching sale: ${error.message}`);
  }
};

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
      products: updatedData.products ?? sale.products,
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

export const deleteSale = async (
  id: number,
  userId?: number
): Promise<void> => {
  try {
    const sale = await ProductSale.findByPk(id);
    if (!sale) throw new Error("Sale not found");

    if (sale.status !== "converted") {
      throw new Error("Only converted sales can be deleted");
    }

    await sale.destroy();

    if (userId) {
      await logActivity(
        userId,
        "delete",
        `Converted sale deleted with ID ${id}`
      );
      await sendNotification(userId, `Converted sale deleted with ID ${id}`);
    }
  } catch (error: any) {
    throw new Error(`Error deleting sale: ${error.message}`);
  }
};

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

    let campaignDetails = null;
    if (data.campaignId) {
      campaignDetails = await Campaign.findByPk(data.campaignId);
    }

    const result: any = product.get();
    if (campaignDetails) {
      result.campaign = campaignDetails.get();
    }

    return result;
  } catch (error: any) {
    throw new Error(`Error creating product: ${error.message}`);
  }
};

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
      status: "pending",
    },
    include: [
      {
        model: Campaign,
        as: "campaign",
      },
    ],
    order: [["createdAt", "DESC"]],
    offset,
    limit: pageLimit,
  });

  return getPagingData(data, page, pageLimit);
};

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

export const deleteProduct = async (
  id: number,
  userId?: number
): Promise<void> => {
  const product = await ProductSale.findByPk(id);
  if (!product) throw new Error("Product not found");

  if (product.status !== "pending") {
    throw new Error("Only pending products can be deleted");
  }

  await product.destroy();

  if (userId) {
    await logActivity(
      userId,
      "delete",
      `Pending product deleted with ID ${id}`
    );
    await sendNotification(userId, `Pending product deleted: ID ${id}`);
  }
};


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

    let parsedProducts: any[] = [];

    if (sale.products) {
      if (typeof sale.products === "string") {
        try {
          const temp = JSON.parse(sale.products);
          parsedProducts = Array.isArray(temp) ? temp : [temp];
        } catch (err) {

          parsedProducts = [
            {
              productType: sale.productType || "N/A",
              price: sale.price || 0,
              notes: sale.notes || "N/A",
            },
          ];
        }
      } else if (Array.isArray(sale.products)) {
        parsedProducts = sale.products;
      } else if (typeof sale.products === "object") {
        parsedProducts = [sale.products];
      } else {
        parsedProducts = [
          {
            productType: sale.productType || "N/A",
            price: sale.price || 0,
            notes: sale.notes || "N/A",
          },
        ];
      }
    } else {
      parsedProducts = [
        {
          productType: sale.productType || "N/A",
          price: sale.price || 0,
          notes: sale.notes || "N/A",
        },
      ];
    }

    const totalAmount = parsedProducts.reduce(
      (sum: number, p: any) => sum + (parseFloat(p.price) || 0),
      0
    );

    return {
      invoiceNumber: `INV-${sale.id}`,
      date: sale.conversionDate,
      sale: {
        ...sale.get({ plain: true }),
        parsedProducts,
      },
      lead: sale.Lead,
      assignee: sale.assignee,
      campaign: sale.campaign,
      products: parsedProducts,
      totalAmount,
      success: true,
    };
  } catch (error: any) {
    throw new Error(`Failed to fetch invoice: ${error.message}`);
  }
};

export const getSalesByAssigneeId = async (
  assigneeId: number | string,
  page: number = 1,
  limit: number = 10,
  search: string = ""
) => {


  try {
    const numericId = Number(assigneeId);
    if (isNaN(numericId)) throw new Error("Invalid assignee ID");
    const { offset, limit: pageLimit } = getPagination({ page, limit });
    const where: any = { assigneeId: numericId };
    const include: any = [
      {
        model: Lead,
        attributes: ["id", "campaignName", "leadData"],
      },
      {
        model: User,
        attributes: ["id", "firstname", "email"],
      },
    ];
    if (search.trim()) {
      where[Op.or] = [
        { productType: { [Op.like]: `%${search}%` } },
        { price: { [Op.like]: `%${search}%` } },
        { notes: { [Op.like]: `%${search}%` } },
        { status: { [Op.like]: `%${search}%` } },
        { "$Lead.campaignName$": { [Op.like]: `%${search}%` } },
        { "$User.firstname$": { [Op.like]: `%${search}%` } },
        { "$User.email$": { [Op.like]: `%${search}%` } },
        Sequelize.literal(
          `JSON_UNQUOTE(JSON_EXTRACT(Lead.leadData, '$.first_name')) LIKE '%${search}%'`
        ),
        Sequelize.literal(
          `JSON_UNQUOTE(JSON_EXTRACT(Lead.leadData, '$.last_name')) LIKE '%${search}%'`
        ),
        Sequelize.literal(
          `JSON_UNQUOTE(JSON_EXTRACT(Lead.leadData, '$.agent_name')) LIKE '%${search}%'`
        ),
        Sequelize.literal(
          `JSON_UNQUOTE(JSON_EXTRACT(Lead.leadData, '$.state')) LIKE '%${search}%'`
        ),
        Sequelize.literal(
          `JSON_UNQUOTE(JSON_EXTRACT(Lead.leadData, '$.email')) LIKE '%${search}%'`
        ),
        Sequelize.where(
          Sequelize.fn(
            "DATE_FORMAT",
            Sequelize.col("ProductSale.conversionDate"),
            "%Y-%m-%d"
          ),
          { [Op.like]: `%${search}%` }
        ),
      ];
    }
    const sales = await ProductSale.findAndCountAll({
      offset,
      limit: pageLimit,
      where,
      include,
      order: [["createdAt", "DESC"]],
    });
    if (!sales || sales.count === 0)
      throw new Error("No sales found for this assignee");
    return getPagingData(sales, page, pageLimit);
  } catch (error: any) {
    throw new Error(`Error fetching sales by assigneeId: ${error.message}`);
  }
};
