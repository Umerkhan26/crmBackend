import { DataTypes, Model, Optional } from "sequelize";
import db from "../../db";

export interface TeamMemberAttributes {
  id: number;
  teamId: number;
  userId: number;
  status: "active" | "inactive";
  joinedAt: Date;
  leftAt?: Date | null;
}

export interface TeamMemberCreationAttributes
  extends Optional<TeamMemberAttributes, "id" | "joinedAt" | "leftAt"> {}

export class TeamMember
  extends Model<TeamMemberAttributes, TeamMemberCreationAttributes>
  implements TeamMemberAttributes
{
  public id!: number;
  public teamId!: number;
  public userId!: number;
  public status!: "active" | "inactive";
  public joinedAt!: Date;
  public leftAt?: Date | null;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

TeamMember.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    teamId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "teams", key: "id" },
      onDelete: "CASCADE",
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "users", key: "id" },
      onDelete: "CASCADE",
      unique: true, // a user can be active in only one team at a time (enforced at DB level)
    },
    status: {
      type: DataTypes.ENUM("active", "inactive"),
      allowNull: false,
      defaultValue: "active",
    },
    joinedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    leftAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize: db,
    tableName: "team_members",
    timestamps: true,
    indexes: [
      { fields: ["teamId"] },
      { fields: ["userId"], unique: true },
      { fields: ["status"] },
      { fields: ["teamId", "status"] },
    ],
  },
);

export default TeamMember;

