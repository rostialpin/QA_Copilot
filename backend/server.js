// QA Copilot Backend Server - Node.js 22 with ES modules
// Load environment variables FIRST before any other imports
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import { router as apiRouter } from './src/routes/index.js';
import configRoutes from './src/routes/configRoutes.js';
import codebaseRoutes from './src/routes/codebaseRoutes.js';
import unifiedRoutes from './src/routes/unifiedRoutes.js';
import { errorHandler } from './src/middleware/errorHandler.js';
import { logger } from './src/utils/logger.js';
import { initDatabase } from './src/utils/database.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware - Allow all localhost origins for development
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      return callback(null, true);
    }

    // Allow any localhost or 127.0.0.1 origin
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return callback(null, true);
    }

    // Allow configured frontend URL
    if (process.env.FRONTEND_URL && origin === process.env.FRONTEND_URL) {
      return callback(null, true);
    }

    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    version: '1.0.0', 
    node: process.version,
    environment: {
      jira: !!process.env.ATLASSIAN_URL,
      testRail: !!process.env.TESTRAIL_URL,
      gemini: !!(process.env.GOOGLE_API_KEY || process.env.GOOGLE_APPLICATION_CREDENTIALS),
      github: !!process.env.GITHUB_TOKEN
    }
  });
});

// Removed mock test endpoint

// API Routes
app.use('/api', apiRouter);
app.use('/api/config', configRoutes);
app.use('/api/codebase', codebaseRoutes);
app.use('/api/unified', unifiedRoutes);

// Error handling
app.use(errorHandler);

// Log environment status
function checkEnvironment() {
  logger.info('=== Environment Configuration ===');
  logger.info(`Node.js version: ${process.version}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  
  // Check for required environment variables
  const configs = {
    'JIRA/Atlassian': !!(process.env.ATLASSIAN_URL && process.env.ATLASSIAN_EMAIL && process.env.ATLASSIAN_TOKEN),
    'TestRail': !!(process.env.TESTRAIL_URL && process.env.TESTRAIL_EMAIL && process.env.TESTRAIL_TOKEN),
    'Gemini/Google AI': !!(process.env.GOOGLE_API_KEY || process.env.GOOGLE_APPLICATION_CREDENTIALS),
    'GitHub': !!process.env.GITHUB_TOKEN
  };
  
  Object.entries(configs).forEach(([service, configured]) => {
    logger.info(`${service}: ${configured ? '✅ Configured' : '⚠️ Not configured'}`);
  });
  
  if (!configs['JIRA/Atlassian']) {
    logger.warn('JIRA not configured - will use mock data');
    logger.info('🎭 Mock mode enabled for demo purposes');
  }
  if (!configs['Gemini/Google AI']) {
    logger.warn('Set GOOGLE_API_KEY or GOOGLE_APPLICATION_CREDENTIALS in ~/.zshrc for AI features');
  }
}

// Start server
async function startServer() {
  try {
    checkEnvironment();
    await initDatabase();
    app.listen(PORT, () => {
      logger.info(`✨ QA Copilot API running on http://localhost:${PORT}`);
      logger.info(`📊 Health check: http://localhost:${PORT}/health`);
      
      // Check if we're in mock mode
      // Real JIRA mode only
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
