// import { DataTypes, Model, Optional } from "sequelize";
// import db from "../../db";

// export interface CampaignAttributes {
//   id: number;
//   campaignName: string;
//   col_name: string;
//   col_slug: string;
//   col_type: "text" | "number" | "date" | "dropdown" | "radio" | "checkbox";
//   default_value?: string;
//   options?: string[];
//   multiple?: boolean;
//   dynamic_fields?: any; // not needed for required fields, used for optional/dynamic ones
// }

// export interface CampaignCreationAttributes extends Optional<CampaignAttributes, "id"> {}

// export const Campaign = db.define<Model<CampaignAttributes, CampaignCreationAttributes>>("Campaign", {
//   id: {
//     type: DataTypes.INTEGER,
//     autoIncrement: true,
//     primaryKey: true,
//   },
//   campaignName: {
//     type: DataTypes.STRING(255),
//     allowNull: false,
//   },
//   col_name: {
//     type: DataTypes.STRING(250),
//     allowNull: false,
//   },
//   col_slug: {
//     type: DataTypes.STRING(250),
//     allowNull: false,
//   },
//   col_type: {
//     type: DataTypes.ENUM("text", "number", "date", "dropdown", "radio", "checkbox"),
//     allowNull: false,
//   },
//   default_value: {
//     type: DataTypes.STRING,
//     allowNull: true,
//   },
//   options: {
//     type: DataTypes.JSON,
//     allowNull: true,
//   },
//   multiple: {
//     type: DataTypes.TINYINT,
//     allowNull: true,
//     defaultValue: false,
//   },
//   dynamic_fields: {
//     type: DataTypes.JSON,
//     allowNull: true,
//   }
// }, {
//   tableName: "campaigns",
//   timestamps: true,
//   indexes: [
//     {
//       unique: false,
//       fields: ['campaignName'],
//     }
//   ]
// });

// export default Campaign;

import { DataTypes, Model, Optional } from "sequelize";
import db from "../../db";

// Defining the interface for Campaign attributes
export interface CampaignAttributes {
  id: number;
  campaignName: string;
  col_name: string;
  col_slug: string;
  col_type: "text" | "number" | "date" | "dropdown" | "radio" | "checkbox";
  default_value?: string;
  options?: string[];
  multiple?: boolean;
  dynamic_fields?: any; // not needed for required fields, used for optional/dynamic ones
}

// Defining the interface for creating Campaign (optional "id")
export interface CampaignCreationAttributes
  extends Optional<CampaignAttributes, "id"> {}

// Extending the Sequelize Model with the custom Campaign model class
class CampaignModel
  extends Model<CampaignAttributes, CampaignCreationAttributes>
  implements CampaignAttributes
{
  public id!: number;
  public campaignName!: string;
  public col_name!: string;
  public col_slug!: string;
  public col_type!:
    | "text"
    | "number"
    | "date"
    | "dropdown"
    | "radio"
    | "checkbox";
  public default_value?: string;
  public options?: string[];
  public multiple?: boolean;
  public dynamic_fields?: any;
}

// Define the Campaign model
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
    col_name: {
      type: DataTypes.STRING(250),
      allowNull: false,
    },
    col_slug: {
      type: DataTypes.STRING(250),
      allowNull: false,
    },
    col_type: {
      type: DataTypes.ENUM(
        "text",
        "number",
        "date",
        "dropdown",
        "radio",
        "checkbox"
      ),
      allowNull: false,
    },
    default_value: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    options: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    multiple: {
      type: DataTypes.TINYINT,
      allowNull: true,
      defaultValue: false,
    },
    dynamic_fields: {
      type: DataTypes.JSON,
      allowNull: true,
    },
  },
  {
    tableName: "campaigns",
    timestamps: true,
    indexes: [
      {
        unique: false,
        fields: ["campaignName"],
      },
    ],
  }
);

// Export the model
export default Campaign;
