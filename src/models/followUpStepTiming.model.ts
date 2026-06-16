import { DataTypes, Model, Optional } from "sequelize";
import db from "../../db";

export type FollowUpDelayUnit = "days" | "hours";

export interface FollowUpStepTimingAttributes {
  id: number;
  stepId: number;
  delayAmount: number;
  delayUnit: FollowUpDelayUnit;
  isActive: boolean;
}

export interface FollowUpStepTimingCreationAttributes
  extends Optional<
    FollowUpStepTimingAttributes,
    "id" | "delayUnit" | "isActive"
  > {}

class FollowUpStepTiming
  extends Model<FollowUpStepTimingAttributes, FollowUpStepTimingCreationAttributes>
  implements FollowUpStepTimingAttributes
{
  public id!: number;
  public stepId!: number;
  public delayAmount!: number;
  public delayUnit!: FollowUpDelayUnit;
  public isActive!: boolean;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

FollowUpStepTiming.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    stepId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
    },
    delayAmount: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    delayUnit: {
      type: DataTypes.ENUM("days", "hours"),
      allowNull: false,
      defaultValue: "days",
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    sequelize: db,
    tableName: "follow_up_step_timings",
    timestamps: true,
  }
);

export default FollowUpStepTiming;
