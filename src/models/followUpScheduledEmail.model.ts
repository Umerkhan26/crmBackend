import { DataTypes, Model, Optional } from "sequelize";
import db from "../../db";

export type FollowUpScheduledEmailStatus =
  | "pending"
  | "processing"
  | "sent"
  | "failed"
  | "skipped"
  | "cancelled";

export interface FollowUpScheduledEmailAttributes {
  id: number;
  enrollmentId: number;
  stepId: number;
  scheduledAt: Date;
  status: FollowUpScheduledEmailStatus;
  attempts: number;
  lastError?: string | null;
  sentAt?: Date | null;
}

export interface FollowUpScheduledEmailCreationAttributes
  extends Optional<
    FollowUpScheduledEmailAttributes,
    "id" | "status" | "attempts" | "lastError" | "sentAt"
  > {}

class FollowUpScheduledEmail
  extends Model<
    FollowUpScheduledEmailAttributes,
    FollowUpScheduledEmailCreationAttributes
  >
  implements FollowUpScheduledEmailAttributes
{
  public id!: number;
  public enrollmentId!: number;
  public stepId!: number;
  public scheduledAt!: Date;
  public status!: FollowUpScheduledEmailStatus;
  public attempts!: number;
  public lastError?: string | null;
  public sentAt?: Date | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

FollowUpScheduledEmail.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    enrollmentId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    stepId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    scheduledAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM(
        "pending",
        "processing",
        "sent",
        "failed",
        "skipped",
        "cancelled"
      ),
      allowNull: false,
      defaultValue: "pending",
    },
    attempts: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    lastError: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    sentAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize: db,
    tableName: "follow_up_scheduled_emails",
    timestamps: true,
    indexes: [
      { unique: true, fields: ["enrollmentId", "stepId"] },
      { fields: ["status", "scheduledAt"] },
    ],
  }
);

export default FollowUpScheduledEmail;
