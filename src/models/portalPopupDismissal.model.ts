import { DataTypes, Model, Optional } from "sequelize";
import db from "../../db";

export interface PortalPopupDismissalAttributes {
  id: number;
  portalCustomerId: number;
  popupId: number;
  brandId: number;
}

export interface PortalPopupDismissalCreationAttributes
  extends Optional<PortalPopupDismissalAttributes, "id"> {}

export class PortalPopupDismissal
  extends Model<
    PortalPopupDismissalAttributes,
    PortalPopupDismissalCreationAttributes
  >
  implements PortalPopupDismissalAttributes
{
  public id!: number;
  public portalCustomerId!: number;
  public popupId!: number;
  public brandId!: number;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

PortalPopupDismissal.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    portalCustomerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    popupId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    brandId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    sequelize: db,
    tableName: "portal_popup_dismissals",
    timestamps: true,
    indexes: [
      { unique: true, fields: ["portalCustomerId", "popupId"] },
      { fields: ["brandId"] },
    ],
  }
);

export default PortalPopupDismissal;
