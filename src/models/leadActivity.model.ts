


import { DataTypes, Model, Optional, Association } from "sequelize";
import db from "../../db";

import User from "./user.model";
import Lead from "./lead.model";

export interface LeadActivityAttributes {
  id: number;
  entityId: number;
  entityType: "lead" | "clientLead";
  action: string;
  details?: string;
  performedBy: number;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date | null;
}

export interface LeadActivityCreationAttributes
  extends Optional<
    LeadActivityAttributes,
    "id" | "details" | "createdAt" | "updatedAt" | "deletedAt"
  > { }

class LeadActivity
  extends Model<LeadActivityAttributes, LeadActivityCreationAttributes>
  implements LeadActivityAttributes {
  public id!: number;
  public entityId!: number;
  public entityType!: "lead" | "clientLead";
  public action!: string;
  public details?: string;
  public performedBy!: number;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
  public readonly deletedAt!: Date | null;

  public performedByUser?: InstanceType<typeof User>;
  public Lead?: InstanceType<typeof Lead>;

  public static associations: {
    performedByUser: Association<LeadActivity, InstanceType<typeof User>>;
    Lead: Association<LeadActivity, InstanceType<typeof Lead>>;
  };
}

LeadActivity.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    entityId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    entityType: {
      type: DataTypes.ENUM("lead", "clientLead"),
      allowNull: false,
    },
    action: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    details: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    performedBy: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    deletedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize: db,
    tableName: "lead_activities",
    timestamps: true,
    paranoid: true,
    indexes: [{ fields: ["entityType", "entityId", "createdAt"] }],
  }
);

export default LeadActivity;
