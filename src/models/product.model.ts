import { DataTypes, Model, Optional } from "sequelize";
import db from "../../db";
import Lead from "./lead.model";
import User from "./user.model";
import Campaign from "./campaign.model";

export interface ProductSaleAttributes {
  id: number;
  leadId?: number;
  productType: string;
  price?: number;
  notes?: string;
  conversionDate?: Date;
  createdBy?: number;
  status: "pending" | "converted" | "cancelled";
  campaignId?: number;
  assigneeId?: number;
  products?: any[] | null;
  brandId?: number | null;
  customerProvisionedAt?: Date | null;
}

export interface ProductSaleCreationAttributes
  extends Optional<
    ProductSaleAttributes,
    | "id"
    | "leadId"
    | "notes"
    | "createdBy"
    | "status"
    | "conversionDate"
    | "assigneeId"
    | "price"
    | "products"
    | "campaignId"
    | "brandId"
    | "customerProvisionedAt"
  > { }

class ProductSale
  extends Model<ProductSaleAttributes, ProductSaleCreationAttributes>
  implements ProductSaleAttributes {
  public id!: number;
  public leadId?: number;
  public productType!: string;
  public price?: number;
  public notes?: string;
  public conversionDate?: Date;
  public createdBy?: number;
  public status!: "pending" | "converted" | "cancelled";
  public campaignId?: number;
  public assigneeId?: number;
  public products?: any[];
  public brandId?: number | null;
  public customerProvisionedAt?: Date | null;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

ProductSale.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    leadId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: Lead,
        key: "id",
      },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
    productType: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    price: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    conversionDate: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: User,
        key: "id",
      },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
    status: {
      type: DataTypes.ENUM("pending", "converted", "cancelled"),
      allowNull: false,
      defaultValue: "pending",
    },
    campaignId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: Campaign,
        key: "id",
      },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
    assigneeId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: User,
        key: "id",
      },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
    products: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    brandId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "brands",
        key: "id",
      },
      onDelete: "SET NULL",
    },
    customerProvisionedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize: db,
    tableName: "product_sales",
    timestamps: true,
  }
);

export default ProductSale;
