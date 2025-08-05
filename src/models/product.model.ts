import { DataTypes, Model, Optional } from "sequelize";
import db from "../../db";
import Lead from "./lead.model";
import User from "./user.model";

export interface ProductSaleAttributes {
  id: number;
  leadId?: number;
  productType: string;
  price: number;
  notes?: string;
  conversionDate?: Date;
  createdBy?: number;
  status: "pending" | "converted" | "cancelled";
  campaignName: string;         // ✅ Added
  assigneeId: number;           // ✅ Added
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
  > {}

class ProductSale
  extends Model<ProductSaleAttributes, ProductSaleCreationAttributes>
  implements ProductSaleAttributes
{
  public id!: number;
  public leadId?: number;
  public productType!: string;
  public price!: number;
  public notes?: string;
  public conversionDate?: Date;
  public createdBy?: number;
  public status!: "pending" | "converted" | "cancelled";
  public campaignName!: string;
  public assigneeId!: number;

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
        model: "leads",
        key: "id",
      },
    },
    productType: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    price: {
      type: DataTypes.FLOAT,
      allowNull: false,
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
        model: "users",
        key: "id",
      },
    },
    status: {
      type: DataTypes.ENUM("pending", "converted", "cancelled"),
      allowNull: false,
      defaultValue: "pending",
    },
    campaignName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    assigneeId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "users",
        key: "id",
      },
    },
  },
  {
    sequelize: db,
    tableName: "product_sales",
    timestamps: true,
  }
);

export default ProductSale;
