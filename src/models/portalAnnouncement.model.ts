import { DataTypes, Model, Optional } from "sequelize";
import db from "../../db";

export type PortalContentStatus = "draft" | "active" | "archived";

export interface PortalAnnouncementAttributes {
  id: number;
  brandId: number;
  title: string;
  body?: string | null;
  linkUrl?: string | null;
  status: PortalContentStatus;
  startsAt?: Date | null;
  endsAt?: Date | null;
  createdBy?: number | null;
}

export interface PortalAnnouncementCreationAttributes
  extends Optional<
    PortalAnnouncementAttributes,
    "id" | "body" | "linkUrl" | "status" | "startsAt" | "endsAt" | "createdBy"
  > {}

export class PortalAnnouncement
  extends Model<
    PortalAnnouncementAttributes,
    PortalAnnouncementCreationAttributes
  >
  implements PortalAnnouncementAttributes
{
  public id!: number;
  public brandId!: number;
  public title!: string;
  public body?: string | null;
  public linkUrl?: string | null;
  public status!: PortalContentStatus;
  public startsAt?: Date | null;
  public endsAt?: Date | null;
  public createdBy?: number | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

PortalAnnouncement.init(
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
    linkUrl: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM("draft", "active", "archived"),
      allowNull: false,
      defaultValue: "draft",
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
    tableName: "portal_announcements",
    timestamps: true,
    indexes: [
      { fields: ["brandId", "status"] },
      { fields: ["startsAt", "endsAt"] },
    ],
  }
);

export default PortalAnnouncement;
