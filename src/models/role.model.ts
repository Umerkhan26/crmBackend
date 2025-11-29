import { DataTypes, Model, Optional } from "sequelize";
import db from "../../db";

export interface RoleAttributes {
  id: number;
  name: string;
  description?: string;
}

interface RoleCreationAttributes extends Optional<RoleAttributes, "id"> { }

export class Role
  extends Model<RoleAttributes, RoleCreationAttributes>
  implements RoleAttributes {
  public id!: number;
  public name!: string;
  public description?: string;
}

Role.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
    },
    description: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
  },
  {
    sequelize: db,
    tableName: "roles",
    modelName: "Role",
    timestamps: true,
  }
);

export default Role;
