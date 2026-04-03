import { DataTypes, Model, Optional } from "sequelize";
import db from "../../db";

export type IncomingLeadStatus =
  | "pending"
  | "validated"
  | "assigned"
  | "promoted"
  | "failed";

export interface IncomingLeadAttributes {
  id: number;
  runId: string; // idempotency key for this import/run
  externalId?: string | null; // source-side identifier (if any)
  campaignName?: string | null;
  payload: any; // raw JSON from source
  dedupeKey?: string | null; // normalized dedupe hash (e.g., normalized phone+campaign)
  status: IncomingLeadStatus;
  errorMessage?: string | null;
  validatedAt?: Date | null;
  assignedAt?: Date | null;
  promotedAt?: Date | null;
  // Optional references for audit (not enforcing FK now to keep staging isolated)
  targetLeadId?: number | null; // id in leads after promotion
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IncomingLeadCreationAttributes
  extends Optional<
    IncomingLeadAttributes,
    | "id"
    | "externalId"
    | "campaignName"
    | "dedupeKey"
    | "status"
    | "errorMessage"
    | "validatedAt"
    | "assignedAt"
    | "promotedAt"
    | "targetLeadId"
    | "createdAt"
    | "updatedAt"
  > {}

export class IncomingLead
  extends Model<IncomingLeadAttributes, IncomingLeadCreationAttributes>
  implements IncomingLeadAttributes
{
  public id!: number;
  public runId!: string;
  public externalId?: string | null;
  public campaignName?: string | null;
  public payload!: any;
  public dedupeKey?: string | null;
  public status!: IncomingLeadStatus;
  public errorMessage?: string | null;
  public validatedAt?: Date | null;
  public assignedAt?: Date | null;
  public promotedAt?: Date | null;
  public targetLeadId?: number | null;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

IncomingLead.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    runId: {
      type: DataTypes.STRING(128),
      allowNull: false,
    },
    externalId: {
      type: DataTypes.STRING(256),
      allowNull: true,
    },
    campaignName: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    payload: {
      type: DataTypes.JSON,
      allowNull: false,
    },
    dedupeKey: {
      type: DataTypes.STRING(256),
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM("pending", "validated", "assigned", "promoted", "failed"),
      allowNull: false,
      defaultValue: "pending",
    },
    errorMessage: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    validatedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    assignedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    promotedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    targetLeadId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    sequelize: db,
    tableName: "incoming_leads",
    timestamps: true,
    indexes: [
      { fields: ["runId"] },
      { fields: ["externalId"] },
      { fields: ["campaignName"] },
      { fields: ["dedupeKey"] },
      { fields: ["status"] },
      { fields: ["promotedAt"] },
    ],
  },
);

export default IncomingLead;
