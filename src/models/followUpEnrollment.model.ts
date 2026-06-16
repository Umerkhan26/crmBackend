import { DataTypes, Model, Optional } from "sequelize";
import db from "../../db";

export type FollowUpEnrollmentStatus =
  | "active"
  | "paused"
  | "completed"
  | "cancelled";

export interface FollowUpEnrollmentAttributes {
  id: number;
  customerAccountId: number;
  sequenceId: number;
  enrolledAt: Date;
  enrolledBy?: number | null;
  status: FollowUpEnrollmentStatus;
}

export interface FollowUpEnrollmentCreationAttributes
  extends Optional<
    FollowUpEnrollmentAttributes,
    "id" | "enrolledBy" | "status"
  > {}

class FollowUpEnrollment
  extends Model<FollowUpEnrollmentAttributes, FollowUpEnrollmentCreationAttributes>
  implements FollowUpEnrollmentAttributes
{
  public id!: number;
  public customerAccountId!: number;
  public sequenceId!: number;
  public enrolledAt!: Date;
  public enrolledBy?: number | null;
  public status!: FollowUpEnrollmentStatus;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

FollowUpEnrollment.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    customerAccountId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    sequenceId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    enrolledAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    enrolledBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM("active", "paused", "completed", "cancelled"),
      allowNull: false,
      defaultValue: "active",
    },
  },
  {
    sequelize: db,
    tableName: "follow_up_enrollments",
    timestamps: true,
    indexes: [
      { unique: true, fields: ["customerAccountId", "sequenceId"] },
      { fields: ["sequenceId", "status"] },
    ],
  }
);

export default FollowUpEnrollment;
