import { DataTypes } from 'sequelize';
import { sequelize } from '../utils/database.js';

export const TestCase = sequelize.define('TestCase', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  jiraKey: {
    type: DataTypes.STRING,
    allowNull: false
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT
  },
  steps: {
    type: DataTypes.JSON
  },
  expectedResult: {
    type: DataTypes.TEXT
  },
  testRailId: {
    type: DataTypes.STRING
  },
  cypressGenerated: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
});
