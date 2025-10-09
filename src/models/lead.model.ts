import { DataTypes, Model, Optional } from "sequelize";
import db from "../../db";
import User from "./user.model"; // Adjust path if needed

// ✅ Allowed statuses
export type LeadStatus =
  | "pending"
  | "to_call"
  | "interested"
  | "most_interested"
  | "sold"
  | "not_interested"
  | "do_not_call";

// ✅ Structure for each assigned user
export interface AssigneeWithStatus {
  userId: number;
  status: LeadStatus;
}

export interface LeadAttributes {
  id: number;
  campaignName: string;
  leadData: any;
  assignees?: AssigneeWithStatus[]; // multiple users with their statuses
}

export interface LeadCreationAttributes
  extends Optional<LeadAttributes, "id"> {}

export class Lead
  extends Model<LeadAttributes, LeadCreationAttributes>
  implements LeadAttributes {
  public id!: number;
  public campaignName!: string;
  public leadData!: any;
  public assignees?: AssigneeWithStatus[];

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  public readonly assignedUsers?: InstanceType<typeof User>[];
}

Lead.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    campaignName: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    leadData: {
      type: DataTypes.JSON,
      allowNull: false,
    },
    assignees: {
      type: DataTypes.JSON, // Store { userId, status } for each assigned user
      allowNull: true,
      defaultValue: [], // Always an array
    },
  },
  {
    sequelize: db,
    tableName: "leads",
    timestamps: true,
    indexes: [{ fields: ["campaignName"] }],
  }
);

// ✅ Allowed status list
const ALLOWED_STATUSES: LeadStatus[] = [
  "pending",
  "to_call",
  "interested",
  "most_interested",
  "sold",
  "not_interested",
  "do_not_call",
];

// ✅ Ensure `assignees` is always an array
Lead.beforeValidate((lead) => {
  if (!Array.isArray(lead.assignees)) {
    lead.assignees = [];
  }
});

// ✅ Set default status & validate statuses
Lead.beforeCreate((lead) => {
  if (Array.isArray(lead.assignees)) {
    lead.assignees = lead.assignees.map((a) => ({
      ...a,
      status: ALLOWED_STATUSES.includes(a.status) ? a.status : "pending",
    }));
  }
});

Lead.beforeUpdate((lead) => {
  if (Array.isArray(lead.assignees)) {
    lead.assignees = lead.assignees.map((a) => ({
      ...a,
      status: ALLOWED_STATUSES.includes(a.status) ? a.status : "pending",
    }));
  }
});

export default Lead;
