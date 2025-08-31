import { DataTypes } from 'sequelize';
import { sequelize } from '../utils/database.js';

export const Sprint = sequelize.define('Sprint', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  jiraId: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  state: {
    type: DataTypes.STRING
  },
  startDate: {
    type: DataTypes.DATE
  },
  endDate: {
    type: DataTypes.DATE
  },
  boardId: {
    type: DataTypes.STRING
  }
});
