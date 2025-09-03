// models/activitylog.model.ts
import { DataTypes, Model } from "sequelize";
import db from "../../db";

export interface ActivityLogAttributes {
  id?: number;
  userId: number;
  userName?: string | null;   // ✅ allow null
  action: string;
  details?: string;
  created_at?: Date;
}

export const ActivityLog = db.define<Model<ActivityLogAttributes>>(
  "ActivityLog",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    userName: {
      type: DataTypes.STRING(255), // ✅ add username
      allowNull: true,
    },
    action: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    details: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "activity_logs",
    timestamps: false,
  }
);

export default ActivityLog;
