// import { DataTypes, Model, Optional } from "sequelize";
// import db from "../../db";

// // Define the attributes of the Permission model
// interface PermissionAttributes {
//   id: number;
//   name: string; // permission like "edit_campaign"
//   resourceType?: string | null; // e.g., 'campaign', 'order'
//   resourceId?: number | null; // e.g., specific campaign ID
//   userId?: number; // <-- ✅ Required
// }

// // Define creation attributes (id is optional during creation)
// interface PermissionCreationAttributes
//   extends Optional<PermissionAttributes, "id"> {}

// export const Permission = db.define<
//   Model<PermissionAttributes, PermissionCreationAttributes>
// >(
//   "Permission",
//   {
//     id: {
//       type: DataTypes.INTEGER,
//       autoIncrement: true,
//       primaryKey: true,
//     },
//     userId: {
//       type: DataTypes.INTEGER,
//       allowNull: false,
//     },
//     name: {
//       type: DataTypes.STRING(100),
//       allowNull: false,
//       unique: false, // set to false if you're allowing same name for different resources
//     },
//     resourceType: {
//       type: DataTypes.STRING,
//       allowNull: true, // optional for backward compatibility
//     },
//     resourceId: {
//       type: DataTypes.INTEGER,
//       allowNull: true, // optional for backward compatibility
//     },
//   },
//   {
//     tableName: "permissions",
//     timestamps: false,
//   }
// );
// export default Permission;

import { DataTypes, Model, Optional } from "sequelize";
import db from "../../db";

// Define the attributes of the Permission model
interface PermissionAttributes {
  id: number;
  name: string;
  resourceType?: string | null;
  resourceId?: number | null;
  userId?: number;
}

// Define creation attributes (id is optional during creation)
interface PermissionCreationAttributes
  extends Optional<PermissionAttributes, "id"> {}

export class Permission
  extends Model<PermissionAttributes, PermissionCreationAttributes>
  implements PermissionAttributes
{
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
