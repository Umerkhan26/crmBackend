import { DataTypes, Model, Optional } from "sequelize";
import db from "../../db";
import Lead from "./lead.model";
import User from "./user.model"; // For createdBy

export interface ProductSaleAttributes {
  id: number;
  leadId: number;
  productType: string; // e.g., Web Development, Graphic Design
  price: number;
  notes?: string;
  conversionDate: Date;
  createdBy?: number; // User who converted the lead
  status: "pending" | "converted" | "cancelled"; // ✅ added
}

export interface ProductSaleCreationAttributes
  extends Optional<ProductSaleAttributes, "id" | "notes" | "createdBy" | "status"> {}

class ProductSale
  extends Model<ProductSaleAttributes, ProductSaleCreationAttributes>
  implements ProductSaleAttributes
{
  public id!: number;
  public leadId!: number;
  public productType!: string;
  public price!: number;
  public notes?: string;
  public conversionDate!: Date;
  public createdBy?: number;
  public status!: "pending" | "converted" | "cancelled"; // ✅ added

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
      allowNull: false,
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
      allowNull: false,
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
      type: DataTypes.ENUM("pending", "converted", "cancelled"), // ✅ ENUM for limited values
      allowNull: false,
      defaultValue: "pending", // ✅ default to pending
    },
  },
  {
    sequelize: db,
    tableName: "product_sales",
    timestamps: true,
  }
);

// Optional: Define associations (uncomment if used)
// ProductSale.belongsTo(Lead, { foreignKey: "leadId" });
// Lead.hasOne(ProductSale, { foreignKey: "leadId" });
// ProductSale.belongsTo(User, { foreignKey: "createdBy" });

export default ProductSale;
