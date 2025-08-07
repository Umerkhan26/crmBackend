import { DataTypes, Model, Optional } from "sequelize";
import db from "../../db";

export interface LeadActivityAttributes {
  id: number;
  leadId: number;
  action: string; // e.g., "status_updated", "email_sent"
  details?: string; // Optional details like status changed, email subject, etc.
  performedBy: number; // User ID who did the action
  createdAt?: Date;
  updatedAt?: Date;
}

export interface LeadActivityCreationAttributes
  extends Optional<LeadActivityAttributes, "id" | "details" | "createdAt" | "updatedAt"> {}

class LeadActivity
  extends Model<LeadActivityAttributes, LeadActivityCreationAttributes>
  implements LeadActivityAttributes {
  public id!: number;
  public leadId!: number;
  public action!: string;
  public details?: string;
  public performedBy!: number;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

LeadActivity.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    leadId: {
      type: DataTypes.INTEGER,
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
  },
  {
    sequelize: db,
    tableName: "lead_activities",
    timestamps: true,
  }
);

export default LeadActivity;
