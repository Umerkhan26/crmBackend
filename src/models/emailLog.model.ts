import { DataTypes } from "sequelize";
import db from "../../db";

export const EmailLog = db.define(
  "EmailLog",
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    to: { type: DataTypes.STRING, allowNull: false },
    subject: { type: DataTypes.TEXT },
    body: { type: DataTypes.TEXT("long") },
    status: { type: DataTypes.STRING },
    serviceName: { type: DataTypes.STRING },
    errorMsg: { type: DataTypes.TEXT },
    sentAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    /** Unique token for open-tracking pixel URL */
    openToken: {
      type: DataTypes.STRING(64),
      allowNull: true,
      unique: true,
    },
    openedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    openCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    customerAccountId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    tableName: "email_logs",
    timestamps: false,
    indexes: [
      { fields: ["openToken"], unique: true },
      { fields: ["customerAccountId", "sentAt"] },
      { fields: ["status", "openedAt"] },
    ],
  }
);

export default EmailLog;
