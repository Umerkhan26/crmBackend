import { DataTypes, Model, Optional } from "sequelize";
import db from "../../db";

export type BulkEmailJobStatus =
  | "pending"
  | "processing"
  | "sent"
  | "failed"
  | "cancelled";

export interface BulkEmailJobAttributes {
  id: number;
  campaignId: number;
  customerAccountId: number;
  toEmail: string;
  recipientFirstname?: string | null;
  recipientLastname?: string | null;
  status: BulkEmailJobStatus;
  attempts: number;
  lastError?: string | null;
  sentAt?: Date | null;
}

export interface BulkEmailJobCreationAttributes
  extends Optional<
    BulkEmailJobAttributes,
    | "id"
    | "recipientFirstname"
    | "recipientLastname"
    | "status"
    | "attempts"
    | "lastError"
    | "sentAt"
  > {}

class BulkEmailJob
  extends Model<BulkEmailJobAttributes, BulkEmailJobCreationAttributes>
  implements BulkEmailJobAttributes
{
  public id!: number;
  public campaignId!: number;
  public customerAccountId!: number;
  public toEmail!: string;
  public recipientFirstname?: string | null;
  public recipientLastname?: string | null;
  public status!: BulkEmailJobStatus;
  public attempts!: number;
  public lastError?: string | null;
  public sentAt?: Date | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

BulkEmailJob.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    campaignId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    customerAccountId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    toEmail: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    recipientFirstname: {
      type: DataTypes.STRING(128),
      allowNull: true,
    },
    recipientLastname: {
      type: DataTypes.STRING(128),
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM(
        "pending",
        "processing",
        "sent",
        "failed",
        "cancelled"
      ),
      allowNull: false,
      defaultValue: "pending",
    },
    attempts: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    lastError: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    sentAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize: db,
    tableName: "bulk_email_jobs",
    timestamps: true,
    indexes: [
      { fields: ["campaignId", "status"] },
      { fields: ["status", "id"] },
    ],
  }
);

export default BulkEmailJob;
