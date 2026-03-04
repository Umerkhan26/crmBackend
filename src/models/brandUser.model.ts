import { DataTypes, Model, Optional } from "sequelize";
import db from "../../db";

export interface BrandUserAttributes {
  id: number;
  brandId: number;
  userId: number;
}

export interface BrandUserCreationAttributes
  extends Optional<BrandUserAttributes, "id"> {}

export class BrandUser
  extends Model<BrandUserAttributes, BrandUserCreationAttributes>
  implements BrandUserAttributes {
  public id!: number;
  public brandId!: number;
  public userId!: number;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

BrandUser.init(
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
    userId: {
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
    tableName: "brand_users",
    timestamps: true,
    indexes: [
      { fields: ["brandId"] },
      { fields: ["userId"] },
      { fields: ["brandId", "userId"], unique: true },
    ],
  }
);

export default BrandUser;
