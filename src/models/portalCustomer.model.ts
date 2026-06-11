import { DataTypes, Model, Optional } from "sequelize";
import db from "../../db";
import Brand from "./brand.model";

export interface PortalCustomerAttributes {
  id: number;
  email: string;
  password: string;
  firstname?: string | null;
  lastname?: string | null;
  phone?: string | null;
  brandId?: number | null;
  last_login?: Date | null;
  status: "active" | "suspended";
}

export interface PortalCustomerCreationAttributes
  extends Optional<
    PortalCustomerAttributes,
    "id" | "firstname" | "lastname" | "phone" | "brandId" | "last_login" | "status"
  > {}

export class PortalCustomer
  extends Model<PortalCustomerAttributes, PortalCustomerCreationAttributes>
  implements PortalCustomerAttributes
{
  public id!: number;
  public email!: string;
  public password!: string;
  public firstname?: string | null;
  public lastname?: string | null;
  public phone?: string | null;
  public brandId?: number | null;
  public last_login?: Date | null;
  public status!: "active" | "suspended";

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

PortalCustomer.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    email: {
      type: DataTypes.STRING(250),
      allowNull: false,
      unique: true,
    },
    password: {
      type: DataTypes.STRING(250),
      allowNull: false,
    },
    firstname: {
      type: DataTypes.STRING(250),
      allowNull: true,
    },
    lastname: {
      type: DataTypes.STRING(250),
      allowNull: true,
    },
    phone: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    brandId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: Brand, key: "id" },
      onDelete: "SET NULL",
    },
    last_login: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM("active", "suspended"),
      allowNull: false,
      defaultValue: "active",
    },
  },
  {
    sequelize: db,
    tableName: "portal_customers",
    timestamps: true,
    indexes: [{ unique: true, fields: ["email"] }, { fields: ["brandId"] }],
  }
);

export default PortalCustomer;
