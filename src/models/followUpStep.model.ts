import { DataTypes, Model, Optional } from "sequelize";
import db from "../../db";

export interface FollowUpStepAttributes {
  id: number;
  sequenceId: number;
  name: string;
  sortOrder: number;
  subject: string;
  body: string;
  isActive: boolean;
}

export interface FollowUpStepCreationAttributes
  extends Optional<FollowUpStepAttributes, "id" | "sortOrder" | "isActive"> {}

class FollowUpStep
  extends Model<FollowUpStepAttributes, FollowUpStepCreationAttributes>
  implements FollowUpStepAttributes
{
  public id!: number;
  public sequenceId!: number;
  public name!: string;
  public sortOrder!: number;
  public subject!: string;
  public body!: string;
  public isActive!: boolean;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

FollowUpStep.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    sequenceId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    sortOrder: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    subject: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    body: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    sequelize: db,
    tableName: "follow_up_steps",
    timestamps: true,
    indexes: [{ fields: ["sequenceId", "sortOrder"] }],
  }
);

export default FollowUpStep;
