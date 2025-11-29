

import { DataTypes, Model, Optional } from "sequelize";
import db from "../../db";

interface PermissionAttributes {
  id: number;
  name: string;
  resourceType?: string | null;
  resourceId?: number | null;
  userId?: number;
}

interface PermissionCreationAttributes
  extends Optional<PermissionAttributes, "id"> { }

export class Permission
  extends Model<PermissionAttributes, PermissionCreationAttributes>
  implements PermissionAttributes {
  public id!: number;
  public name!: string;
  public resourceType?: string | null;
  public resourceId?: number | null;
  public userId?: number;
}

Permission.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: false,
    },
    resourceType: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    resourceId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    sequelize: db,
    tableName: "permissions",
    modelName: "Permission",
    timestamps: false,
  }
);

export default Permission;
