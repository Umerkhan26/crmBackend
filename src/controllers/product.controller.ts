import { Request, Response } from "express";
import * as ProductSaleService from "../services/product.service";

// ✅ Convert Lead to Sale
export const convertLeadToSale = async (req: Request, res: Response): Promise<any> => {
  try {
    const { leadId, productType, price, notes, status, campaignId, assigneeId, products } = req.body;
    const createdBy = req.user?.id;

    // ✅ Validation: allow either single product OR products array
    if (!leadId || !campaignId || !assigneeId) {
      return res.status(400).json({ message: "Missing required sale data." });
    }
    if (!products && (!productType || price === undefined)) {
      return res.status(400).json({ message: "Either provide productType & price OR products array." });
    }

    const sale = await ProductSaleService.convertLeadToSale({
      leadId,
      productType,
      price,
      notes,
      products: products ?? null, // ✅ store multiple products if passed
      status: status ?? "converted",
      conversionDate: new Date(),
      createdBy: createdBy ?? undefined,
      campaignId,
      assigneeId,
    }, createdBy);

    return res.status(201).json({
      success: true,
      message: "Lead converted to sale successfully",
      data: sale,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};


// ✅ Get All Sales
export const getAllSales = async (req: Request, res: Response): Promise<any> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = (req.query.search as string) || "";

    const filters: any = {};
    if (req.query.productType) filters.productType = req.query.productType;
    if (req.query.status) filters.status = req.query.status;

    const salesData = await ProductSaleService.getAllSales({
      page,
      limit,
      search,
      filters,
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

// ✅ Get Sale by ID
export const getSaleById = async (req: Request, res: Response): Promise<any> => {
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

// ✅ Update Sale
export const updateSale = async (req: Request, res: Response): Promise<any> => {
  try {
    const saleId = parseInt(req.params.id, 10);
    const updatedData = req.body;
    const userId = req.user?.id;

    if (isNaN(saleId)) {
      return res.status(400).json({ message: "Invalid sale ID" });
    }

    // ✅ Allow products array updates
    const updatedSale = await ProductSaleService.updateSale(saleId, {
      ...updatedData,
      products: updatedData.products ?? undefined
    }, userId);

    return res.status(200).json({
      success: true,
      message: "Sale updated successfully",
      data: updatedSale,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};


// ✅ Delete Sale
export const deleteSale = async (req: Request, res: Response): Promise<any> => {
  try {
    const saleId = parseInt(req.params.id, 10);
    const userId = req.user?.id;

    if (isNaN(saleId)) {
      return res.status(400).json({ message: "Invalid sale ID" });
    }

    await ProductSaleService.deleteSale(saleId, userId);

    return res.status(200).json({
      success: true,
      message: "Sale deleted successfully",
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ Get Sales by Product Type
export const getSalesByProductType = async (req: Request, res: Response): Promise<any> => {
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



// ✅ Create Product
export const createProduct = async (req: Request, res: Response): Promise<any> => {
  try {
    const { productType, price, notes, status, campaignId, assigneeId } = req.body;
    const createdBy = req.user?.id;

    // ✅ Only check for productType and campaignId — price is now optional
    if (!productType || !campaignId) {
      return res.status(400).json({
        message: "Missing required fields: productType or campaignId.",
      });
    }

    const newProduct = await ProductSaleService.createProduct(
      {
        productType,
        price,         // ✅ can be undefined
        notes,
        status,
        campaignId,
        ...(assigneeId && { assigneeId }),
        createdBy,     // ✅ passed to track who created it
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

// ✅ Get Product by ID
export const getProductById = async (req: Request, res: Response): Promise<any> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid product ID" });

    const product = await ProductSaleService.getProductById(id);
    return res.status(200).json({ success: true, data: product });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ Get All Products
export const getAllProducts = async (_req: Request, res: Response): Promise<any> => {
  try {
    const products = await ProductSaleService.getAllProducts();
    return res.status(200).json({ success: true, data: products });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ Update Product
export const updateProduct = async (req: Request, res: Response): Promise<any> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid product ID" });

    const userId = req.user?.id;
    const updatedProduct = await ProductSaleService.updateProduct(id, req.body, userId);

    return res.status(200).json({
      success: true,
      message: "Product updated successfully",
      data: updatedProduct,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ Delete Product
export const deleteProduct = async (req: Request, res: Response): Promise<any> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid product ID" });

    const userId = req.user?.id;
    await ProductSaleService.deleteProduct(id, userId);

    return res.status(200).json({
      success: true,
      message: "Product deleted successfully",
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ Get Products by Campaign & Assignee
export const getProductsByCampaignAndAssignee = async (req: Request, res: Response): Promise<any> => {
  try {
    const campaignId = parseInt(req.params.campaignId, 10);
    const assigneeId = parseInt(req.query.assigneeId as string, 10);

    if (isNaN(campaignId) || isNaN(assigneeId)) {
      return res.status(400).json({ message: "campaignId and assigneeId must be valid numbers." });
    }

    const products = await ProductSaleService.getProductsByCampaignAndAssignee(campaignId, assigneeId);

    if (products.length === 0) {
      return res.status(404).json({ message: "No products found for this campaign and assignee." });
    }

    return res.status(200).json({ success: true, data: products });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};



export const getInvoice = async (req: Request, res: Response):Promise<any> => {
  try {
    const { leadId } = req.params;

    if (!leadId) {
      return res.status(400).json({ success: false, message: "Lead ID is required" });
    }

    const invoice = await ProductSaleService.getInvoiceByLeadId(Number(leadId));

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

export const getSalesByAssigneeIdController = async (req: Request, res: Response): Promise<any> => {
  try {
    const assigneeId = parseInt(req.params.assigneeId, 10);
    console.log("🔍 [Controller] Received assigneeId:", assigneeId);

    if (isNaN(assigneeId)) {
      console.error("❌ Invalid assignee ID:", req.params.assigneeId);
      return res.status(400).json({ message: "Invalid assignee ID" });
    }

    const sales = await ProductSaleService.getSalesByAssigneeId(assigneeId);
    console.log("📦 [Controller] Sales fetched:", sales);

    if (!sales || sales.length === 0) {
      console.warn("⚠️ No sales found for assigneeId:", assigneeId);
      return res.status(404).json({ message: "No sales found for this assignee" });
    }

    return res.status(200).json({
      success: true,
      message: "Sales fetched successfully",
      data: sales,
    });
  } catch (error: any) {
    console.error("🔥 Error in getSalesByAssigneeId controller:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};