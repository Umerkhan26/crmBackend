import { DataTypes, Model, Optional } from "sequelize";
import db from "../../db";
import User from "./user.model"; // Adjust path if needed

export interface LeadAttributes {
  id: number;
  campaignName: string;
  leadData: any;
  assigneeIds?: number[]; // Multiple user IDs assigned to this lead
}

export interface LeadCreationAttributes
  extends Optional<LeadAttributes, "id"> {}

class Lead
  extends Model<LeadAttributes, LeadCreationAttributes>
  implements LeadAttributes
{
  public id!: number;
  public campaignName!: string;
  public leadData!: any;
  public assigneeIds?: number[];

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Association (optional)
  public readonly assignees?: InstanceType<typeof User>[];
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
    assigneeIds: {
      type: DataTypes.JSON, // Store multiple user IDs
      allowNull: true,
      defaultValue: [],
    },
  },
  {
    sequelize: db,
    tableName: "leads",
    timestamps: true,
    indexes: [{ fields: ["campaignName"] }],
  }
);

export default Lead;
