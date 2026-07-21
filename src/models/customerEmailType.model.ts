import { DataTypes, Model, Optional } from "sequelize";
import db from "../../db";

export type CustomerEmailFlowKey =
  | "credentials"
  | "invoice"
  | "notification"
  | "promotional"
  | "followUp"
  | "bulk";

export interface CustomerEmailTypeAttributes {
  id: number;
  slug: string;
  label: string;
  mailboxPrefix: string;
  description?: string | null;
  sortOrder: number;
  isActive: boolean;
  flowDefaults: CustomerEmailFlowKey[];
}

export interface CustomerEmailTypeCreationAttributes
  extends Optional<
    CustomerEmailTypeAttributes,
    "id" | "description" | "sortOrder" | "isActive" | "flowDefaults"
  > {}

class CustomerEmailType
  extends Model<CustomerEmailTypeAttributes, CustomerEmailTypeCreationAttributes>
  implements CustomerEmailTypeAttributes
{
  public id!: number;
  public slug!: string;
  public label!: string;
  public mailboxPrefix!: string;
  public description?: string | null;
  public sortOrder!: number;
  public isActive!: boolean;
  public flowDefaults!: CustomerEmailFlowKey[];
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

CustomerEmailType.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    slug: {
      type: DataTypes.STRING(64),
      allowNull: false,
      unique: true,
    },
    label: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    mailboxPrefix: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    sortOrder: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    flowDefaults: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
    },
  },
  {
    sequelize: db,
    tableName: "customer_email_types",
    timestamps: true,
    // Do not re-declare unique(slug) here — field already has unique: true.
    // Repeated alter:true syncs were creating duplicate indexes until MySQL's 64-key limit.
    indexes: [{ fields: ["isActive"] }, { fields: ["sortOrder"] }],
  }
);

export default CustomerEmailType;
