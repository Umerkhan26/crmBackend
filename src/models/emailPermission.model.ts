import { DataTypes, Model, Optional } from "sequelize";
import db from "../../db";

// Update interface to allow null for allowedRoles
export interface EmailPermissionAttributes {
  id?: number;
  serviceName: string;
  canSend: boolean;
  allowedRoles?: string | null; // ✅ Allow null
}

// Optional ID for creation
interface EmailPermissionCreationAttributes
  extends Optional<EmailPermissionAttributes, "id"> {}

export class EmailPermission
  extends Model<EmailPermissionAttributes, EmailPermissionCreationAttributes>
  implements EmailPermissionAttributes
{
  public id!: number;
  public serviceName!: string;
  public canSend!: boolean;
  public allowedRoles?: string | null; // ✅ Allow null in class too
}

// Sequelize model definition
EmailPermission.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    serviceName: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    canSend: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    allowedRoles: {
      type: DataTypes.STRING,
      allowNull: true, // ✅ Sequelize also allows null
    },
  },
  {
    sequelize: db,
    tableName: "email_permissions",
    modelName: "EmailPermission",
    timestamps: true,
  }
);

export default EmailPermission;
