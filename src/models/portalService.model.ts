import { DataTypes, Model, Optional } from "sequelize";
import db from "../../db";
import type { PortalServiceFormField } from "../types/portalServiceForm";

export type PortalServiceStatus = "draft" | "active" | "archived";

export interface PortalServiceAttributes {
  id: number;
  brandId: number;
  name: string;
  slug: string;
  shortDescription?: string | null;
  detailedContent?: string | null;
  iconUrl?: string | null;
  sortOrder: number;
  status: PortalServiceStatus;
  formFields: PortalServiceFormField[];
  createdBy?: number | null;
}

export interface PortalServiceCreationAttributes
  extends Optional<
    PortalServiceAttributes,
    | "id"
    | "shortDescription"
    | "detailedContent"
    | "iconUrl"
    | "sortOrder"
    | "status"
    | "formFields"
    | "createdBy"
  > {}

class PortalService
  extends Model<PortalServiceAttributes, PortalServiceCreationAttributes>
  implements PortalServiceAttributes
{
  public id!: number;
  public brandId!: number;
  public name!: string;
  public slug!: string;
  public shortDescription?: string | null;
  public detailedContent?: string | null;
  public iconUrl?: string | null;
  public sortOrder!: number;
  public status!: PortalServiceStatus;
  public formFields!: PortalServiceFormField[];
  public createdBy?: number | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

PortalService.init(
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
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    slug: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    shortDescription: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    detailedContent: {
      type: DataTypes.TEXT("long"),
      allowNull: true,
    },
    iconUrl: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    sortOrder: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    status: {
      type: DataTypes.ENUM("draft", "active", "archived"),
      allowNull: false,
      defaultValue: "draft",
    },
    formFields: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
    },
    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    sequelize: db,
    tableName: "portal_services",
    timestamps: true,
    indexes: [
      { unique: true, fields: ["brandId", "slug"] },
      { fields: ["brandId", "status", "sortOrder"] },
    ],
  }
);

export default PortalService;
