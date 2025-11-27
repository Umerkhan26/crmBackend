import { DataTypes, Model, Optional } from "sequelize";
import db from "../../db";
import User from "./user.model"; // Adjust path if needed

export type LeadStatus =
  | "pending"
  | "to_call"
  | "interested"
  | "most_interested"
  | "sold"
  | "not_interested"
  | "do_not_call";

export interface AssigneeWithStatus {
  userId: number;
  status: LeadStatus;
  assignedAt: string;
}

export interface LeadAttributes {
  id: number; // keep as number
  campaignName: string;
  leadData: any;
  assignees?: AssigneeWithStatus[];
}

export interface LeadCreationAttributes
  extends Optional<LeadAttributes, "id"> { }

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

  // ✅ New virtual/computed field
  public get leadCode(): string {
    // Example: fd1, fd2 based on campaign initials + id
    const initials = this.campaignName
      .split(" ")
      .map((word) => word[0].toLowerCase())
      .join("");
    return `${initials}${this.id}`;
  }
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
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: [],
    },
  },
  {
    sequelize: db,
    tableName: "leads",
    timestamps: true,
    indexes: [{ fields: ["campaignName"] }],
    getterMethods: {
      // Optional: can also use Sequelize getter for JSON responses
      leadCode() {
        const lead = this as Lead;
        const initials = lead.campaignName
          .split(" ")
          .map((word) => word[0].toLowerCase())
          .join("");
        return `${initials}${lead.id}`;
      },
    },
  }
);

// Allowed statuses
const ALLOWED_STATUSES: LeadStatus[] = [
  "pending",
  "to_call",
  "interested",
  "most_interested",
  "sold",
  "not_interested",
  "do_not_call",
];

Lead.beforeValidate((lead) => {
  if (!Array.isArray(lead.assignees)) lead.assignees = [];
});

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
