import { DataTypes, Model } from "sequelize";
import db from "../../db";

export class RolePermission extends Model {
  public roleId!: number;
  public permissionId!: number;
}

RolePermission.init(
  {
    roleId: {
      type: DataTypes.INTEGER,
      references: {
        model: "roles",
        key: "id",
      },
      allowNull: false,
    },
    permissionId: {
      type: DataTypes.INTEGER,
      references: {
        model: "permissions",
        key: "id",
      },
      allowNull: false,
    },
  },
  {
    sequelize: db,
    tableName: "role_permissions",
    modelName: "RolePermission",
    timestamps: false,
    indexes: [
      {
        unique: true,
        fields: ["roleId", "permissionId"],
      },
    ],
  }
);

export default RolePermission;
