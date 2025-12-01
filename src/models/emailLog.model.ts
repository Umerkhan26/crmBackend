import { DataTypes } from "sequelize";
import db from "../../db";

export const EmailLog = db.define("EmailLog", {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  to: { type: DataTypes.STRING, allowNull: false },
  subject: { type: DataTypes.TEXT },
  body: { type: DataTypes.TEXT },
  status: { type: DataTypes.STRING },
  serviceName: { type: DataTypes.STRING },
  errorMsg: { type: DataTypes.TEXT },
  sentAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
}, {
  tableName: "email_logs",
  timestamps: false,
});

export default EmailLog;
