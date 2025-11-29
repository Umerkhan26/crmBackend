import { DataTypes, Model, Optional } from "sequelize";
import db from "../../db";
import User from "./user.model";

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
  id: number;
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

  public get leadCode(): string {
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
