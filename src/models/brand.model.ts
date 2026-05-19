import { DataTypes, Model, Optional } from "sequelize";
import db from "../../db";

export interface BrandAttributes {
  id: number;
  name: string;
  description?: string;
  status: "active" | "inactive";
  slug?: string | null;
  subdomain?: string | null;
  customerPortalUrl?: string | null;
  defaultCampaignId?: number | null;
  salesFormConfig?: Record<string, unknown> | null;
}

export interface BrandCreationAttributes
  extends Optional<
    BrandAttributes,
    | "id"
    | "slug"
    | "subdomain"
    | "customerPortalUrl"
    | "defaultCampaignId"
    | "salesFormConfig"
  > {}

export class Brand
  extends Model<BrandAttributes, BrandCreationAttributes>
  implements BrandAttributes {
  public id!: number;
  public name!: string;
  public description?: string;
  public status!: "active" | "inactive";
  public slug?: string | null;
  public subdomain?: string | null;
  public customerPortalUrl?: string | null;
  public defaultCampaignId?: number | null;
  public salesFormConfig?: Record<string, unknown> | null;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Brand.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM("active", "inactive"),
      allowNull: false,
      defaultValue: "active",
    },
    slug: {
      type: DataTypes.STRING(100),
      allowNull: true,
      unique: true,
    },
    subdomain: {
      type: DataTypes.STRING(255),
      allowNull: true,
      unique: true,
    },
    customerPortalUrl: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    defaultCampaignId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    salesFormConfig: {
      type: DataTypes.JSON,
      allowNull: true,
    },
  },
  {
    sequelize: db,
    tableName: "brands",
    timestamps: true,
    indexes: [
      { fields: ["name"] },
      { fields: ["status"] },
      { fields: ["slug"] },
      { fields: ["subdomain"] },
    ],
  }
);

export default Brand;
