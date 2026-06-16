import { DataTypes, Model, Optional } from "sequelize";
import db from "../../db";

export type PortalServiceSubmissionStatus =
  | "new"
  | "in_review"
  | "completed"
  | "cancelled";

export interface PortalServiceSubmissionAttributes {
  id: number;
  serviceId: number;
  brandId: number;
  customerAccountId: number;
  portalCustomerId: number;
  formData: Record<string, unknown>;
  status: PortalServiceSubmissionStatus;
  adminNotes?: string | null;
  submittedAt: Date;
}

export interface PortalServiceSubmissionCreationAttributes
  extends Optional<
    PortalServiceSubmissionAttributes,
    "id" | "status" | "adminNotes"
  > {}

class PortalServiceSubmission
  extends Model<
    PortalServiceSubmissionAttributes,
    PortalServiceSubmissionCreationAttributes
  >
  implements PortalServiceSubmissionAttributes
{
  public id!: number;
  public serviceId!: number;
  public brandId!: number;
  public customerAccountId!: number;
  public portalCustomerId!: number;
  public formData!: Record<string, unknown>;
  public status!: PortalServiceSubmissionStatus;
  public adminNotes?: string | null;
  public submittedAt!: Date;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

PortalServiceSubmission.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    serviceId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    brandId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    customerAccountId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    portalCustomerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    formData: {
      type: DataTypes.JSON,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM("new", "in_review", "completed", "cancelled"),
      allowNull: false,
      defaultValue: "new",
    },
    adminNotes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    submittedAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  },
  {
    sequelize: db,
    tableName: "portal_service_submissions",
    timestamps: true,
    indexes: [
      { fields: ["brandId", "status", "submittedAt"] },
      { fields: ["serviceId", "submittedAt"] },
      { fields: ["customerAccountId", "submittedAt"] },
    ],
  }
);

export default PortalServiceSubmission;
