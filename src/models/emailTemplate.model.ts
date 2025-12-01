import { DataTypes, Model, Optional } from "sequelize";
import db from "../../db";

export interface EmailTemplateAttributes {
  id?: number;
  name: string;
  serviceName: string;
  subjectTemplate: string;
  bodyTemplate: string;
  createdBy?: number;
}

interface EmailTemplateCreationAttributes extends Optional<EmailTemplateAttributes, "id"> { }

class EmailTemplateModel extends Model<EmailTemplateAttributes, EmailTemplateCreationAttributes>
  implements EmailTemplateAttributes {
  public id!: number;
  public name!: string;
  public serviceName!: string;
  public subjectTemplate!: string;
  public bodyTemplate!: string;
  public createdBy?: number;
}

const EmailTemplate = EmailTemplateModel.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    serviceName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    subjectTemplate: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    bodyTemplate: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    sequelize: db,
    tableName: "email_templates",
    modelName: "EmailTemplate",
    timestamps: true,
  }
);

export default EmailTemplate;
