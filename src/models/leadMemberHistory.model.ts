import { DataTypes, Model, Optional } from "sequelize";
import db from "../../db";

export interface LeadMemberHistoryAttributes {
  id: number;
  leadId: number;
  teamId: number;
  userId: number;
  cycleNo: number;
  assignedAt: Date;
  source?: "assign" | "rebalance" | "rotate" | null;
  isLockedAssignment?: boolean;
}

export interface LeadMemberHistoryCreationAttributes
  extends Optional<LeadMemberHistoryAttributes, "id" | "assignedAt" | "source" | "isLockedAssignment"> {}

export class LeadMemberHistory
  extends Model<LeadMemberHistoryAttributes, LeadMemberHistoryCreationAttributes>
  implements LeadMemberHistoryAttributes
{
  public id!: number;
  public leadId!: number;
  public teamId!: number;
  public userId!: number;
  public cycleNo!: number;
  public assignedAt!: Date;
  public source?: "assign" | "rebalance" | "rotate" | null;
  public isLockedAssignment?: boolean;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

LeadMemberHistory.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    leadId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "leads", key: "id" },
      onDelete: "CASCADE",
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
    },
    cycleNo: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    assignedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    source: {
      type: DataTypes.ENUM("assign", "rebalance", "rotate"),
      allowNull: true,
    },
    isLockedAssignment: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    sequelize: db,
    tableName: "lead_member_history",
    timestamps: true,
    indexes: [
      { fields: ["leadId"] },
      { fields: ["teamId"] },
      { fields: ["userId"] },
      { fields: ["teamId", "cycleNo"] },
      { fields: ["leadId", "teamId", "cycleNo"] },
      { fields: ["leadId", "teamId", "userId", "cycleNo"], unique: true },
    ],
  },
);

export default LeadMemberHistory;

