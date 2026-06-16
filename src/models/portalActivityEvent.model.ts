import { DataTypes, Model, Optional } from "sequelize";
import db from "../../db";

export type PortalActivityAction =
  | "login"
  | "dashboard_view"
  | "view_orders"
  | "view_invoices"
  | "view_offers"
  | "view_announcements"
  | "view_notifications"
  | "view_order"
  | "dismiss_popup"
  | "download_invoice"
  | "view_services"
  | "service_form_submitted";

export interface PortalActivityEventAttributes {
  id: number;
  customerAccountId: number;
  portalCustomerId: number;
  brandId?: number | null;
  action: PortalActivityAction;
  title: string;
  metadata?: Record<string, unknown> | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface PortalActivityEventCreationAttributes
  extends Optional<
    PortalActivityEventAttributes,
    "id" | "brandId" | "metadata"
  > {}

class PortalActivityEvent
  extends Model<
    PortalActivityEventAttributes,
    PortalActivityEventCreationAttributes
  >
  implements PortalActivityEventAttributes
{
  public id!: number;
  public customerAccountId!: number;
  public portalCustomerId!: number;
  public brandId?: number | null;
  public action!: PortalActivityAction;
  public title!: string;
  public metadata?: Record<string, unknown> | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

PortalActivityEvent.init(
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
    portalCustomerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    brandId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    action: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
    },
  },
  {
    sequelize: db,
    tableName: "portal_activity_events",
    timestamps: true,
    indexes: [
      { fields: ["customerAccountId", "createdAt"] },
      { fields: ["portalCustomerId", "createdAt"] },
      { fields: ["action"] },
    ],
  }
);

export default PortalActivityEvent;
