import { DataTypes, Model, Optional } from "sequelize";
import db from "../../db";
import type { PortalContentStatus } from "./portalAnnouncement.model";

export interface PortalPopupAttributes {
  id: number;
  brandId: number;
  title: string;
  body?: string | null;
  imageUrl?: string | null;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
  status: PortalContentStatus;
  priority: number;
  startsAt?: Date | null;
  endsAt?: Date | null;
  createdBy?: number | null;
}

export interface PortalPopupCreationAttributes
  extends Optional<
    PortalPopupAttributes,
    | "id"
    | "body"
    | "imageUrl"
    | "ctaLabel"
    | "ctaUrl"
    | "status"
    | "priority"
    | "startsAt"
    | "endsAt"
    | "createdBy"
  > {}

export class PortalPopup
  extends Model<PortalPopupAttributes, PortalPopupCreationAttributes>
  implements PortalPopupAttributes
{
  public id!: number;
  public brandId!: number;
  public title!: string;
  public body?: string | null;
  public imageUrl?: string | null;
  public ctaLabel?: string | null;
  public ctaUrl?: string | null;
  public status!: PortalContentStatus;
  public priority!: number;
  public startsAt?: Date | null;
  public endsAt?: Date | null;
  public createdBy?: number | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

PortalPopup.init(
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
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    body: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    imageUrl: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    ctaLabel: {
      type: DataTypes.STRING(120),
      allowNull: true,
    },
    ctaUrl: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM("draft", "active", "archived"),
      allowNull: false,
      defaultValue: "draft",
    },
    priority: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    startsAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    endsAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    sequelize: db,
    tableName: "portal_popups",
    timestamps: true,
    indexes: [{ fields: ["brandId", "status", "priority"] }],
  }
);

export default PortalPopup;
