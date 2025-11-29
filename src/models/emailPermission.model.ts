import { DataTypes, Model, Optional } from "sequelize";
import db from "../../db";

export interface EmailPermissionAttributes {
  id?: number;
  serviceName: string;
  canSend: boolean;
  allowedRoles?: string | null;
}

interface EmailPermissionCreationAttributes
  extends Optional<EmailPermissionAttributes, "id"> { }

export class EmailPermission
  extends Model<EmailPermissionAttributes, EmailPermissionCreationAttributes>
  implements EmailPermissionAttributes {
  public id!: number;
  public serviceName!: string;
  public canSend!: boolean;
  public allowedRoles?: string | null;
}

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
      allowNull: true,
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
