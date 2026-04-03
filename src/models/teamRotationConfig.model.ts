import { DataTypes, Model, Optional } from "sequelize";
import db from "../../db";

export interface TeamRotationConfigAttributes {
  id: number;
  enabled: boolean;
  rotationOrder: number[]; // array of Team IDs in order A->E
  tenureHours?: number | null; // default rotation window in hours
  timezone?: string | null; // e.g., "Asia/Karachi"
}

export interface TeamRotationConfigCreationAttributes
  extends Optional<TeamRotationConfigAttributes, "id" | "enabled" | "tenureHours" | "timezone"> {}

export class TeamRotationConfig
  extends Model<TeamRotationConfigAttributes, TeamRotationConfigCreationAttributes>
  implements TeamRotationConfigAttributes
{
  public id!: number;
  public enabled!: boolean;
  public rotationOrder!: number[];

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

TeamRotationConfig.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    enabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    rotationOrder: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
    },
    tenureHours: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    timezone: {
      type: DataTypes.STRING(64),
      allowNull: true,
    },
  },
  {
    sequelize: db,
    tableName: "team_rotation_config",
    timestamps: true,
  },
);

export default TeamRotationConfig;
