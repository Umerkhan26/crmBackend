import { DataTypes, Model, Optional } from "sequelize";
import db from "../../db";

export interface LeadRotationStateAttributes {
  id: number;
  leadId: number;
  teamId: number;
  enteredTeamAt: Date;
}

export interface LeadRotationStateCreationAttributes
  extends Optional<LeadRotationStateAttributes, "id" | "enteredTeamAt"> {}

export class LeadRotationState
  extends Model<LeadRotationStateAttributes, LeadRotationStateCreationAttributes>
  implements LeadRotationStateAttributes
{
  public id!: number;
  public leadId!: number;
  public teamId!: number;
  public enteredTeamAt!: Date;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

LeadRotationState.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    leadId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "leads", key: "id" },
      onDelete: "CASCADE",
      unique: true,
    },
    teamId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "teams", key: "id" },
      onDelete: "SET NULL",
    },
    enteredTeamAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize: db,
    tableName: "lead_rotation_state",
    timestamps: true,
    indexes: [
      { fields: ["leadId"], unique: true },
      { fields: ["teamId"] },
      { fields: ["enteredTeamAt"] },
    ],
  },
);

export default LeadRotationState;
