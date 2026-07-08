import { Request, Response } from "express";
import * as ProductSaleService from "../services/product.service";
import {
  buildCustomerAccountSaleScopeWhere,
  resolveCustomerListScope,
} from "../utils/customerAccountScope";

const resolveSaleListScopeWhere = async (
  userId?: number,
  permissions: string[] = [],
): Promise<Record<string, unknown> | null> => {
  if (!userId) return null;
  const scopeResult = await resolveCustomerListScope(userId, permissions);
  return buildCustomerAccountSaleScopeWhere(scopeResult);
};

export const convertLeadToSale = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const {
      leadId,
      productType,
      price,
      notes,
      status,
      campaignId,
      assigneeId,
      products,
      brandId,
      autoProvisionCustomer,
    } = req.body;
    const createdBy = req.user?.id;

    if (!leadId || !campaignId || !assigneeId) {
      return res.status(400).json({ message: "Missing required sale data." });
    }
    if (!products && (!productType || price === undefined)) {
      return res.status(400).json({
        message: "Either provide productType & price OR products array.",
      });
    }

    const sale = await ProductSaleService.convertLeadToSale(
      {
        leadId,
        productType,
        price,
        notes,
        products: products ?? null,
        status: status ?? "converted",
        conversionDate: new Date(),
        createdBy: createdBy ?? undefined,
        campaignId,
        assigneeId,
        brandId: brandId ? Number(brandId) : undefined,
        autoProvisionCustomer:
          autoProvisionCustomer !== undefined ? Boolean(autoProvisionCustomer) : true,
      },
      createdBy
    );

    return res.status(201).json({
      success: true,
      message: "Lead converted to sale successfully",
      data: sale,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getAllSales = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = (req.query.search as string) || "";
    const filters: any = {};
    if (req.query.productType) filters.productType = req.query.productType;
    if (req.query.status) filters.status = req.query.status;
    if (req.query.brandId) {
      const brandId = parseInt(String(req.query.brandId), 10);
      if (Number.isFinite(brandId)) filters.brandId = brandId;
    }
    if (req.query.conversionDateFrom) {
      filters.conversionDateFrom = String(req.query.conversionDateFrom);
    }
    if (req.query.conversionDateTo) {
      filters.conversionDateTo = String(req.query.conversionDateTo);
    }
    if (req.query.createdBy) {
      const createdBy = parseInt(String(req.query.createdBy), 10);
      if (Number.isFinite(createdBy)) filters.createdBy = createdBy;
    }
    const scopeWhere = await resolveSaleListScopeWhere(
      req.user?.id,
      req.user?.permissions || [],
    );
    const salesData = await ProductSaleService.getAllSales({
      page,
      limit,
      search,
      filters,
      scopeWhere,
    });
    return res.status(200).json({
      success: true,
      message: "Sales fetched successfully",
      ...salesData,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getSalesSummaryByBrandController = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const filters: Record<string, unknown> = {};
    if (req.query.status) filters.status = String(req.query.status);
    if (req.query.conversionDateFrom) {
      filters.conversionDateFrom = String(req.query.conversionDateFrom);
    }
    if (req.query.conversionDateTo) {
      filters.conversionDateTo = String(req.query.conversionDateTo);
    }
    if (req.query.createdBy) {
      const createdBy = parseInt(String(req.query.createdBy), 10);
      if (Number.isFinite(createdBy)) filters.createdBy = createdBy;
    }

    const scopeWhere = await resolveSaleListScopeWhere(
      req.user?.id,
      req.user?.permissions || [],
    );
    const data = await ProductSaleService.getSalesSummaryByBrand(
      filters,
      scopeWhere,
    );
    return res.status(200).json({
      success: true,
      message: "Sales summary by brand",
      data,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getSaleById = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const saleId = parseInt(req.params.id, 10);
    if (isNaN(saleId)) {
      return res.status(400).json({ message: "Invalid sale ID" });
    }

    const sale = await ProductSaleService.getSaleById(saleId);
    if (!sale) {
      return res.status(404).json({ message: "Sale not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Sale fetched successfully",
      data: sale,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateSale = async (req: Request, res: Response): Promise<any> => {
  try {
    const saleId = parseInt(req.params.id, 10);
    const updatedData = req.body;
    const userId = req.user?.id;

    if (isNaN(saleId)) {
      return res.status(400).json({ message: "Invalid sale ID" });
    }

    const updatedSale = await ProductSaleService.updateSale(
      saleId,
      {
        ...updatedData,
        products: updatedData.products ?? undefined,
      },
      userId
    );

    return res.status(200).json({
      success: true,
      message: "Sale updated successfully",
      data: updatedSale,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteSale = async (req: Request, res: Response): Promise<any> => {
  try {
    const saleId = parseInt(req.params.id, 10);
    const userId = req.user?.id;

    if (isNaN(saleId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid sale ID" });
    }

    await ProductSaleService.deleteSale(saleId, userId);

    return res.status(200).json({
      success: true,
      message: "Sale deleted successfully",
    });
  } catch (error: any) {
    const message = String(error.message || "");
    if (message.includes("Sale not found")) {
      return res.status(404).json({ success: false, message: "Sale not found" });
    }

    return res.status(500).json({ success: false, message });
  }
};

export const getSalesByProductType = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const { type } = req.params;

    if (!type) {
      return res.status(400).json({ message: "Product type is required" });
    }

    const sales = await ProductSaleService.getSalesByProductType(type);

    return res.status(200).json({
      success: true,
      message: `Sales fetched for product type: ${type}`,
      data: sales,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const createProduct = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const { productType, price, notes, assigneeId } = req.body;
    const createdBy = req.user?.id;

    if (!productType) {
      return res.status(400).json({
        message: "Missing required field: productType.",
      });
    }

    const newProduct = await ProductSaleService.createProduct(
      {
        productType,
        price,
        notes,
        ...(assigneeId && { assigneeId }),
        createdBy,
      },
      createdBy
    );

    return res.status(201).json({
      success: true,
      message: "Product created successfully",
      data: newProduct,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getProductById = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id))
      return res.status(400).json({ message: "Invalid product ID" });

    const product = await ProductSaleService.getProductById(id);
    return res.status(200).json({ success: true, data: product });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};


export const getAllProducts = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    const products = await ProductSaleService.getAllProducts(page, limit);

    return res.status(200).json({
      success: true,
      ...products,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateProduct = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id))
      return res.status(400).json({ message: "Invalid product ID" });

    const userId = req.user?.id;
    const updatedProduct = await ProductSaleService.updateProduct(
      id,
      req.body,
      userId
    );

    return res.status(200).json({
      success: true,
      message: "Product updated successfully",
      data: updatedProduct,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteProduct = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid product ID" });
    }

    const userId = req.user?.id;
    await ProductSaleService.deleteProduct(id, userId);

    return res.status(200).json({
      success: true,
      message: "Product deleted successfully",
    });
  } catch (error: any) {
    if (error.message === "Product not found") {
      return res.status(404).json({ success: false, message: error.message });
    }
    if (error.message === "Only pending products can be deleted") {
      return res.status(400).json({ success: false, message: error.message });
    }

    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getProductsByCampaignAndAssignee = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const campaignId = parseInt(req.params.campaignId, 10);
    const assigneeId = parseInt(req.query.assigneeId as string, 10);

    if (isNaN(campaignId) || isNaN(assigneeId)) {
      return res
        .status(400)
        .json({ message: "campaignId and assigneeId must be valid numbers." });
    }

    const products = await ProductSaleService.getProductsByCampaignAndAssignee(
      campaignId,
      assigneeId
    );

    if (products.length === 0) {
      return res
        .status(404)
        .json({ message: "No products found for this campaign and assignee." });
    }

    return res.status(200).json({ success: true, data: products });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};



export const getInvoice = async (req: Request, res: Response): Promise<any> => {
  try {
    const { leadId } = req.params;

    if (!leadId) {
      return res
        .status(400)
        .json({ success: false, message: "Lead ID is required" });
    }

    const leadIdNum = Number(leadId);
    if (isNaN(leadIdNum)) {
      return res
        .status(400)
        .json({ success: false, message: "Lead ID must be a valid number" });
    }

    const invoice = await ProductSaleService.getInvoiceByLeadId(leadIdNum);

    return res.status(200).json({
      success: true,
      message: "Invoice fetched successfully",
      data: invoice,
    });
  } catch (error: any) {

    return res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while fetching invoice",
    });
  }
};

export const getSalesByLeadCreatorController = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const creatorId = parseInt(req.params.id, 10);
    if (isNaN(creatorId))
      return res.status(400).json({ message: "Invalid creator ID" });

    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit
      ? parseInt(req.query.limit as string, 10)
      : 10;
    const search = (req.query.search as string) || "";
    const brandId = req.query.brandId
      ? parseInt(String(req.query.brandId), 10)
      : undefined;

    const salesData = await ProductSaleService.getSalesByLeadCreator(
      creatorId,
      page,
      limit,
      search,
      Number.isFinite(brandId) ? brandId : undefined,
    );

    return res.status(200).json({
      success: true,
      message: "Sales fetched successfully",
      data: salesData.data,
      totalItems: salesData.totalItems,
      totalPages: salesData.totalPages,
      currentPage: salesData.currentPage,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch sales",
    });
  }
};

export const getSalesByAssigneeIdController = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const assigneeId = parseInt(req.params.id, 10);
    if (isNaN(assigneeId))
      return res.status(400).json({ message: "Invalid assignee ID" });

    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit
      ? parseInt(req.query.limit as string, 10)
      : 10;
    const search = (req.query.search as string) || "";
    const brandId = req.query.brandId
      ? parseInt(String(req.query.brandId), 10)
      : undefined;

    const salesData = await ProductSaleService.getSalesByAssigneeId(
      assigneeId,
      page,
      limit,
      search,
      Number.isFinite(brandId) ? brandId : undefined,
    );

    if (!salesData || !salesData.data || salesData.data.length === 0)
      return res
        .status(404)
        .json({ success: false, message: "No sales found for this assignee" });

    return res.status(200).json({
      success: true,
      message: "Sales fetched successfully",
      ...salesData,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || "Internal Server Error",
    });
  }
};
