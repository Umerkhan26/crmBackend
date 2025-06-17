// import { Model, DataTypes, Optional } from 'sequelize';
// import sequelize from '../../db'; // adjust path as needed

// // Define the attributes
// export interface EmailRuleAttributes {
//   id: number;
//   service: string;
//   can_send: boolean;
//   createdAt?: Date;
//   updatedAt?: Date;
// }

// // Optional for creation
// export interface EmailRuleCreationAttributes extends Optional<EmailRuleAttributes, 'id'> {}

// class EmailRule extends Model<EmailRuleAttributes, EmailRuleCreationAttributes>
//   implements EmailRuleAttributes {
//   public id!: number;
//   public service!: string;
//   public can_send!: boolean;

//   // timestamps
//   public readonly createdAt!: Date;
//   public readonly updatedAt!: Date;
// }

// // Define model
// EmailRule.init(
//   {
//     id: {
//       type: DataTypes.INTEGER.UNSIGNED,
//       autoIncrement: true,
//       primaryKey: true,
//     },
//     service: {
//       type: DataTypes.STRING,
//       allowNull: false,
//     },
//     can_send: {
//       type: DataTypes.BOOLEAN,
//       allowNull: false,
//       defaultValue: true,
//     },
//   },
//   {
//     sequelize,
//     modelName: 'EmailRule',
//     tableName: 'email_rules',
//   }
// );

// export default EmailRule;
