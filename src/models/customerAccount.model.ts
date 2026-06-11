import { DataTypes, Model, Optional } from "sequelize";
import db from "../../db";
import PortalCustomer from "./portalCustomer.model";
import Brand from "./brand.model";
import Lead from "./lead.model";
import ProductSale from "./product.model";

export interface CustomerAccountAttributes {
  id: number;
  portalCustomerId: number;
  brandId?: number | null;
  leadId?: number | null;
  saleId?: number | null;
  status: "active" | "suspended";
}

export interface CustomerAccountCreationAttributes
  extends Optional<
    CustomerAccountAttributes,
    "id" | "leadId" | "saleId" | "status" | "brandId"
  > {}

export class CustomerAccount
  extends Model<CustomerAccountAttributes, CustomerAccountCreationAttributes>
  implements CustomerAccountAttributes
{
  public id!: number;
  public portalCustomerId!: number;
  public brandId?: number | null;
  public leadId?: number | null;
  public saleId?: number | null;
  public status!: "active" | "suspended";

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

CustomerAccount.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    portalCustomerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: PortalCustomer, key: "id" },
      onDelete: "CASCADE",
    },
    brandId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: Brand, key: "id" },
      onDelete: "SET NULL",
    },
    leadId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: Lead, key: "id" },
      onDelete: "SET NULL",
    },
    saleId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: ProductSale, key: "id" },
      onDelete: "SET NULL",
    },
    status: {
      type: DataTypes.ENUM("active", "suspended"),
      allowNull: false,
      defaultValue: "active",
    },
  },
  {
    sequelize: db,
    tableName: "customer_accounts",
    timestamps: true,
    indexes: [
      { fields: ["portalCustomerId"] },
      { fields: ["brandId"] },
      { fields: ["leadId"] },
      { fields: ["saleId"], unique: true },
    ],
  }
);

export default CustomerAccount;
