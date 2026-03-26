import { DataTypes, Model, Optional } from "sequelize";
import db from "../../db";

export interface TeamAttributes {
  id: number;
  name: string;
  code: string; // e.g. "A", "B", "C", "D", "E"
  sortOrder: number; // team rotation order
  status: "active" | "inactive";
}

export interface TeamCreationAttributes extends Optional<TeamAttributes, "id"> {}

export class Team
  extends Model<TeamAttributes, TeamCreationAttributes>
  implements TeamAttributes
{
  public id!: number;
  public name!: string;
  public code!: string;
  public sortOrder!: number;
  public status!: "active" | "inactive";

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Team.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    code: {
      type: DataTypes.STRING(32),
      allowNull: false,
      unique: true,
    },
    sortOrder: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    status: {
      type: DataTypes.ENUM("active", "inactive"),
      allowNull: false,
      defaultValue: "active",
    },
  },
  {
    sequelize: db,
    tableName: "teams",
    timestamps: true,
    indexes: [
      { fields: ["code"], unique: true },
      { fields: ["sortOrder"] },
      { fields: ["status"] },
    ],
  },
);

export default Team;

