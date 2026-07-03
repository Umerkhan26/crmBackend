import { DataTypes, Model, Optional } from "sequelize";
import db from "../../db";
import type { CustomerEmailType } from "../constants/customerEmailTypes";

export type BulkEmailCampaignStatus =
  | "queued"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled";

export interface BulkEmailCampaignFilters {
  brandId?: number;
  status?: "active" | "suspended";
  /** When set, only these customer accounts (must be active unless status overridden). */
  customerAccountIds?: number[];
}

export interface BulkEmailCampaignSmtpConfig {
  host: string;
  port: number;
  user: string;
  fromName?: string;
  emailType?: CustomerEmailType;
  source?: string;
}

export interface BulkEmailCampaignAttributes {
  id: number;
  subject: string;
  body: string;
  category: string;
  emailType: CustomerEmailType;
  filters: BulkEmailCampaignFilters | null;
  status: BulkEmailCampaignStatus;
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  smtpConfig: BulkEmailCampaignSmtpConfig;
  createdBy: number;
  startedAt?: Date | null;
  completedAt?: Date | null;
}

export interface BulkEmailCampaignCreationAttributes
  extends Optional<
    BulkEmailCampaignAttributes,
    | "id"
    | "filters"
    | "status"
    | "totalRecipients"
    | "sentCount"
    | "failedCount"
    | "emailType"
    | "startedAt"
    | "completedAt"
  > {}

class BulkEmailCampaign
  extends Model<BulkEmailCampaignAttributes, BulkEmailCampaignCreationAttributes>
  implements BulkEmailCampaignAttributes
{
  public id!: number;
  public subject!: string;
  public body!: string;
  public category!: string;
  public emailType!: CustomerEmailType;
  public filters!: BulkEmailCampaignFilters | null;
  public status!: BulkEmailCampaignStatus;
  public totalRecipients!: number;
  public sentCount!: number;
  public failedCount!: number;
  public smtpConfig!: BulkEmailCampaignSmtpConfig;
  public createdBy!: number;
  public startedAt?: Date | null;
  public completedAt?: Date | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

BulkEmailCampaign.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    subject: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    body: {
      type: DataTypes.TEXT("long"),
      allowNull: false,
    },
    category: {
      type: DataTypes.STRING(64),
      allowNull: false,
      defaultValue: "promotional",
    },
    emailType: {
      type: DataTypes.STRING(64),
      allowNull: false,
      defaultValue: "promotions",
    },
    filters: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM(
        "queued",
        "processing",
        "completed",
        "failed",
        "cancelled"
      ),
      allowNull: false,
      defaultValue: "queued",
    },
    totalRecipients: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    sentCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    failedCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    smtpConfig: {
      type: DataTypes.JSON,
      allowNull: false,
    },
    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    startedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    completedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize: db,
    tableName: "bulk_email_campaigns",
    timestamps: true,
    indexes: [{ fields: ["status"] }, { fields: ["createdBy"] }],
  }
);

export default BulkEmailCampaign;
