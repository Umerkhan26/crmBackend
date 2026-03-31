import { DataTypes, Model, Optional } from "sequelize";
import db from "../../db";

export type BatchTriggerType = "daily" | "manual" | "import";
export type BatchStatus = "running" | "completed" | "failed" | "partial";

export interface LeadAssignmentBatchAttributes {
  id: number;
  runId: string;
  triggerType: BatchTriggerType;
  status: BatchStatus;
  startedAt: Date;
  finishedAt?: Date | null;
  triggeredByUserId?: number | null;
  rotatedCount: number;
  rebalancedCount: number;
  newAssignedCount: number;
  metadata?: Record<string, any> | null;
  errorMessage?: string | null;
}

export interface LeadAssignmentBatchCreationAttributes
  extends Optional<
    LeadAssignmentBatchAttributes,
    | "id"
    | "status"
    | "startedAt"
    | "finishedAt"
    | "triggeredByUserId"
    | "rotatedCount"
    | "rebalancedCount"
    | "newAssignedCount"
    | "metadata"
    | "errorMessage"
  > {}

export class LeadAssignmentBatch
  extends Model<LeadAssignmentBatchAttributes, LeadAssignmentBatchCreationAttributes>
  implements LeadAssignmentBatchAttributes
{
  public id!: number;
  public runId!: string;
  public triggerType!: BatchTriggerType;
  public status!: BatchStatus;
  public startedAt!: Date;
  public finishedAt?: Date | null;
  public triggeredByUserId?: number | null;
  public rotatedCount!: number;
  public rebalancedCount!: number;
  public newAssignedCount!: number;
  public metadata?: Record<string, any> | null;
  public errorMessage?: string | null;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

LeadAssignmentBatch.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    runId: {
      type: DataTypes.STRING(128),
      allowNull: false,
      unique: true,
    },
    triggerType: {
      type: DataTypes.ENUM("daily", "manual", "import"),
      allowNull: false,
      defaultValue: "manual",
    },
    status: {
      type: DataTypes.ENUM("running", "completed", "failed", "partial"),
      allowNull: false,
      defaultValue: "running",
    },
    startedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    finishedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    triggeredByUserId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "users", key: "id" },
      onDelete: "SET NULL",
    },
    rotatedCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    rebalancedCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    newAssignedCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    errorMessage: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize: db,
    tableName: "lead_assignment_batches",
    timestamps: true,
    indexes: [
      { fields: ["runId"], unique: true },
      { fields: ["status"] },
      { fields: ["startedAt"] },
      { fields: ["triggerType"] },
      { fields: ["triggeredByUserId"] },
    ],
  },
);

export default LeadAssignmentBatch;
