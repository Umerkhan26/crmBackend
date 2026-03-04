import { DataTypes, Model, Optional } from "sequelize";
import db from "../../db";

export interface BrandAttributes {
  id: number;
  name: string;
  description?: string;
  status: "active" | "inactive";
}

export interface BrandCreationAttributes
  extends Optional<BrandAttributes, "id"> {}

export class Brand
  extends Model<BrandAttributes, BrandCreationAttributes>
  implements BrandAttributes {
  public id!: number;
  public name!: string;
  public description?: string;
  public status!: "active" | "inactive";

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
  },
  {
    sequelize: db,
    tableName: "brands",
    timestamps: true,
    indexes: [{ fields: ["name"] }, { fields: ["status"] }],
  }
);

export default Brand;
