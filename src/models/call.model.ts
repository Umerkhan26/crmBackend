import { DataTypes, Model, Optional } from "sequelize";
import db from "../../db";

export type CallDirection = "outgoing" | "incoming";
export type CallStatus = "initiated" | "in_progress" | "completed" | "failed";

export interface CallAttributes {
  id: number;
  userId: number;
  phoneNumber: string;
  direction: CallDirection;
  status: CallStatus;
  startedAt: Date;
  endedAt?: Date | null;
  durationSeconds?: number | null;
  transcript?: string | null;
  consent: boolean;
  sttProvider?: string | null;
  externalCallId?: string | null;
  leadId?: number | null;
  clientLeadId?: number | null;
  metadata?: any | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CallCreationAttributes
  extends Optional<
    CallAttributes,
    | "id"
    | "endedAt"
    | "durationSeconds"
    | "transcript"
    | "sttProvider"
    | "externalCallId"
    | "leadId"
    | "clientLeadId"
    | "metadata"
    | "createdAt"
    | "updatedAt"
  > {}

export class Call
  extends Model<CallAttributes, CallCreationAttributes>
  implements CallAttributes
{
  public id!: number;
  public userId!: number;
  public phoneNumber!: string;
  public direction!: CallDirection;
  public status!: CallStatus;
  public startedAt!: Date;
  public endedAt?: Date | null;
  public durationSeconds?: number | null;
  public transcript?: string | null;
  public consent!: boolean;
  public sttProvider?: string | null;
  public externalCallId?: string | null;
  public leadId?: number | null;
  public clientLeadId?: number | null;
  public metadata?: any | null;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Call.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "users", key: "id" },
    },
    phoneNumber: { type: DataTypes.STRING(64), allowNull: false },
    direction: {
      type: DataTypes.ENUM("outgoing", "incoming"),
      allowNull: false,
      defaultValue: "outgoing",
    },
    status: {
      type: DataTypes.ENUM("initiated", "in_progress", "completed", "failed"),
      allowNull: false,
      defaultValue: "initiated",
    },
    startedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    endedAt: { type: DataTypes.DATE, allowNull: true },
    durationSeconds: { type: DataTypes.INTEGER, allowNull: true },
    transcript: { type: DataTypes.TEXT("long"), allowNull: true },
    consent: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    sttProvider: { type: DataTypes.STRING(64), allowNull: true },
    externalCallId: { type: DataTypes.STRING(128), allowNull: true },
    leadId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "leads", key: "id" },
    },
    clientLeadId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "client_leads", key: "id" },
    },
    metadata: { type: DataTypes.JSON, allowNull: true },
  },
  {
    sequelize: db,
    tableName: "calls",
    timestamps: true,
    indexes: [
      { fields: ["userId"] },
      { fields: ["phoneNumber"] },
      { fields: ["startedAt"] },
      { fields: ["externalCallId"] },
    ],
  }
);

export default Call;

