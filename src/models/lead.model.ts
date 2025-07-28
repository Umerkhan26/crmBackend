import { DataTypes, Model, Optional } from "sequelize";
import db from "../../db";
import User from "./user.model"; // Adjust path if needed

export interface LeadAttributes {
  id: number;
  campaignName: string;
  leadData: any;
  assigneeId?: number; // The user assigned to this lead
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
  public assigneeId?: number;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Association (optional)
  public readonly assignee?: InstanceType<typeof User>;
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
    assigneeId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "users", // Reference the 'users' table
        key: "id",
      },
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
