import { DataTypes, Model, Optional } from "sequelize";
import db from "../../db";

export type CustomerEngagementType =
  | "upsell"
  | "promotional_email"
  | "discount"
  | "notification"
  | "internal_note";

export type CustomerEngagementStatus =
  | "draft"
  | "sent"
  | "active"
  | "applied"
  | "cancelled";

export interface CustomerEngagementAttributes {
  id: number;
  customerAccountId: number;
  type: CustomerEngagementType;
  title: string;
  details?: string | null;
  metadata?: Record<string, unknown> | null;
  status: CustomerEngagementStatus;
  createdBy: number;
}

export interface CustomerEngagementCreationAttributes
  extends Optional<
    CustomerEngagementAttributes,
    "id" | "details" | "metadata" | "status"
  > {}

class CustomerEngagement
  extends Model<
    CustomerEngagementAttributes,
    CustomerEngagementCreationAttributes
  >
  implements CustomerEngagementAttributes
{
  public id!: number;
  public customerAccountId!: number;
  public type!: CustomerEngagementType;
  public title!: string;
  public details?: string | null;
  public metadata?: Record<string, unknown> | null;
  public status!: CustomerEngagementStatus;
  public createdBy!: number;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

CustomerEngagement.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    customerAccountId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    type: {
      type: DataTypes.ENUM(
        "upsell",
        "promotional_email",
        "discount",
        "notification",
        "internal_note"
      ),
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    details: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM("draft", "sent", "active", "applied", "cancelled"),
      allowNull: false,
      defaultValue: "active",
    },
    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    sequelize: db,
    tableName: "customer_engagements",
    timestamps: true,
    indexes: [{ fields: ["customerAccountId", "createdAt"] }],
  }
);

export default CustomerEngagement;
