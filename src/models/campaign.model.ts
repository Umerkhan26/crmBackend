import { DataTypes, Model, Optional } from "sequelize";
import db from "../../db";

export interface FieldType {
  col_name: string;
  col_slug: string;
  col_type: "text" | "number" | "date" | "dropdown" | "radio" | "checkbox";
  default_value?: string;
  options?: string[];
  multiple?: boolean;
  dynamic_fields?: any;
}

export interface CampaignAttributes {
  id: number;
  campaignName: string;
  fields: FieldType[];
}

export interface CampaignCreationAttributes
  extends Optional<CampaignAttributes, "id"> { }

class CampaignModel
  extends Model<CampaignAttributes, CampaignCreationAttributes>
  implements CampaignAttributes {
  public id!: number;
  public campaignName!: string;
  public fields!: FieldType[];
}

export const Campaign = db.define<CampaignModel>(
  "Campaign",
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
    fields: {
      type: DataTypes.JSON,
      allowNull: false,
    },
  },
  {
    tableName: "campaigns",
    timestamps: true,
  }
);

export default Campaign;
