import { DataTypes, Model, Optional, Op } from "sequelize";
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
  assignedAt: string;
}

export interface LeadAttributes {
  id: string; // Changed to string
  campaignName: string;
  leadData: any;
  assignees?: AssigneeWithStatus[]; // multiple users with their statuses
}

export interface LeadCreationAttributes
  extends Optional<LeadAttributes, "id"> { }

export class Lead
  extends Model<LeadAttributes, LeadCreationAttributes>
  implements LeadAttributes {
  public id!: string; // string ID now
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
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
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

// ✅ Generate string ID before creating
Lead.beforeCreate(async (lead) => {
  // Get initials from campaignName
  const initials = lead.campaignName
    .split(" ")
    .map((word) => word[0].toLowerCase())
    .join("");

  // Find last lead with same initials
  const lastLead = await Lead.findOne({
    where: {
      id: { [Op.like]: `${initials}%` },
    },
    order: [["createdAt", "DESC"]],
  });

  const nextNumber = lastLead
    ? parseInt(lastLead.id.replace(initials, "")) + 1
    : 1;

  lead.id = `${initials}${nextNumber}`; // e.g., fd1, fd2
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
