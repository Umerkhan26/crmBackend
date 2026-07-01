import { DataTypes, Model, Optional } from "sequelize";
import db from "../../db";
import type { CustomerEmailType } from "../constants/customerEmailTypes";

export type FollowUpTrigger = "customer_provisioned";

export interface FollowUpSequenceAttributes {
  id: number;
  name: string;
  trigger: FollowUpTrigger;
  emailType: CustomerEmailType;
  isActive: boolean;
  createdBy?: number | null;
}

export interface FollowUpSequenceCreationAttributes
  extends Optional<FollowUpSequenceAttributes, "id" | "isActive" | "createdBy" | "emailType"> {}

class FollowUpSequence
  extends Model<FollowUpSequenceAttributes, FollowUpSequenceCreationAttributes>
  implements FollowUpSequenceAttributes
{
  public id!: number;
  public name!: string;
  public trigger!: FollowUpTrigger;
  public emailType!: CustomerEmailType;
  public isActive!: boolean;
  public createdBy?: number | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

FollowUpSequence.init(
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
    trigger: {
      type: DataTypes.ENUM("customer_provisioned"),
      allowNull: false,
      defaultValue: "customer_provisioned",
    },
    emailType: {
      type: DataTypes.ENUM("care", "invoice", "promotions"),
      allowNull: false,
      defaultValue: "promotions",
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    sequelize: db,
    tableName: "follow_up_sequences",
    timestamps: true,
  }
);

export default FollowUpSequence;
