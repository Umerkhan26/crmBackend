import { DataTypes, Model, Optional } from "sequelize";
import db from "../../db";

export interface BrandManagerAttributes {
  id: number;
  brandId: number;
  managerId: number; // userId of the manager
}

export interface BrandManagerCreationAttributes
  extends Optional<BrandManagerAttributes, "id"> {}

export class BrandManager
  extends Model<BrandManagerAttributes, BrandManagerCreationAttributes>
  implements BrandManagerAttributes {
  public id!: number;
  public brandId!: number;
  public managerId!: number; // userId of the manager

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

BrandManager.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    brandId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "brands",
        key: "id",
      },
      onDelete: "CASCADE",
    },
    managerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "users",
        key: "id",
      },
      onDelete: "CASCADE",
    },
  },
  {
    sequelize: db,
    tableName: "brand_managers",
    timestamps: true,
    indexes: [
      { fields: ["brandId"] },
      { fields: ["managerId"] },
      { fields: ["brandId", "managerId"], unique: true },
    ],
  }
);

export default BrandManager;
