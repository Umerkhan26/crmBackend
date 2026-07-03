import { DataTypes, Model, Optional } from "sequelize";
import db from "../../db";
import type { CustomerEmailType } from "../constants/customerEmailTypes";

export interface BrandEmailSenderAttributes {
  id: number;
  brandId: number;
  emailType: CustomerEmailType;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPassword: string;
  fromName?: string | null;
  replyTo?: string | null;
  isActive: boolean;
}

export interface BrandEmailSenderCreationAttributes
  extends Optional<
    BrandEmailSenderAttributes,
    "id" | "fromName" | "replyTo" | "isActive"
  > {}

class BrandEmailSender
  extends Model<BrandEmailSenderAttributes, BrandEmailSenderCreationAttributes>
  implements BrandEmailSenderAttributes
{
  public id!: number;
  public brandId!: number;
  public emailType!: CustomerEmailType;
  public smtpHost!: string;
  public smtpPort!: number;
  public smtpUser!: string;
  public smtpPassword!: string;
  public fromName?: string | null;
  public replyTo?: string | null;
  public isActive!: boolean;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

BrandEmailSender.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    brandId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    emailType: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    smtpHost: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    smtpPort: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 465,
    },
    smtpUser: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    smtpPassword: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    fromName: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    replyTo: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    sequelize: db,
    tableName: "brand_email_senders",
    timestamps: true,
    indexes: [
      { unique: true, fields: ["brandId", "emailType"] },
      { fields: ["brandId"] },
      { fields: ["isActive"] },
    ],
  }
);

export default BrandEmailSender;
