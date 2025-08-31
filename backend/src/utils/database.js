import { Sequelize } from 'sequelize';
import { logger } from './logger.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../../database.sqlite');

export const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: dbPath,
  logging: (msg) => logger.debug(msg)
});

export async function initDatabase() {
  try {
    await sequelize.authenticate();
    logger.info('Database connection established');
    
    // Sync models
    await sequelize.sync({ alter: true });
    logger.info('Database synchronized');
  } catch (error) {
    logger.error('Unable to connect to database:', error);
    throw error;
  }
}
