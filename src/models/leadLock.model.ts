import { DataTypes, Model, Optional } from "sequelize";
import db from "../../db";

export type LeadLockStatus = "locked" | "unlocked";

export interface LeadLockAttributes {
  id: number;
  leadId: number;
  lockedByUserId: number;
  status: LeadLockStatus;
  reason?: string | null;
  lockedAt: Date;
  lockUntil?: Date | null;
  unlockedAt?: Date | null;
}

export interface LeadLockCreationAttributes
  extends Optional<LeadLockAttributes, "id" | "status" | "reason" | "lockedAt" | "lockUntil" | "unlockedAt"> {}

export class LeadLock
  extends Model<LeadLockAttributes, LeadLockCreationAttributes>
  implements LeadLockAttributes
{
  public id!: number;
  public leadId!: number;
  public lockedByUserId!: number;
  public status!: LeadLockStatus;
  public reason?: string | null;
  public lockedAt!: Date;
  public lockUntil?: Date | null;
  public unlockedAt?: Date | null;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

LeadLock.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    leadId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "leads", key: "id" },
      onDelete: "CASCADE",
    },
    lockedByUserId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "users", key: "id" },
      onDelete: "CASCADE",
    },
    status: {
      type: DataTypes.ENUM("locked", "unlocked"),
      allowNull: false,
      defaultValue: "locked",
    },
    reason: {
      type: DataTypes.STRING(512),
      allowNull: true,
    },
    lockedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    lockUntil: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    unlockedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize: db,
    tableName: "lead_locks",
    timestamps: true,
    indexes: [
      { fields: ["leadId"] },
      { fields: ["lockedByUserId"] },
      { fields: ["status"] },
      { fields: ["leadId", "status"] },
      { fields: ["lockUntil"] },
      { fields: ["lockedAt"] },
    ],
  },
);

export default LeadLock;
