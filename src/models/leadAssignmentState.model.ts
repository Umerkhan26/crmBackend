import { DataTypes, Model, Optional } from "sequelize";
import db from "../../db";

export interface LeadAssignmentStateAttributes {
  id: number;
  leadId: number;
  teamId: number | null;
  currentAssigneeUserId: number | null;
  lastAssignedAt: Date | null;
  seenUserIds?: number[] | null; // rebalance cycle memory for this lead/team
  cycleStep?: number; // increments on each rebalance assignment within team
  cycleNo?: number; // strong cycle marker used with lead_member_history uniqueness
}

export interface LeadAssignmentStateCreationAttributes
  extends Optional<
    LeadAssignmentStateAttributes,
    "id" | "teamId" | "currentAssigneeUserId" | "lastAssignedAt" | "seenUserIds" | "cycleStep"
    | "cycleNo"
  > {}

export class LeadAssignmentState
  extends Model<LeadAssignmentStateAttributes, LeadAssignmentStateCreationAttributes>
  implements LeadAssignmentStateAttributes
{
  public id!: number;
  public leadId!: number;
  public teamId!: number | null;
  public currentAssigneeUserId!: number | null;
  public lastAssignedAt!: Date | null;
  public seenUserIds?: number[] | null;
  public cycleStep?: number;
  public cycleNo?: number;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

LeadAssignmentState.init(
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
      allowNull: true,
      references: { model: "teams", key: "id" },
      onDelete: "SET NULL",
    },
    currentAssigneeUserId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "users", key: "id" },
      onDelete: "SET NULL",
    },
    lastAssignedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    seenUserIds: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: [],
    },
    cycleStep: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    cycleNo: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
  },
  {
    sequelize: db,
    tableName: "lead_assignment_state",
    timestamps: true,
    indexes: [
      { fields: ["leadId"], unique: true },
      { fields: ["teamId"] },
      { fields: ["currentAssigneeUserId"] },
      { fields: ["lastAssignedAt"] },
    ],
  },
);

export default LeadAssignmentState;
