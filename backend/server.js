// QA Copilot Backend Server - Node.js 22 with ES modules
import express from 'express';
import cors from 'cors';
import { router as apiRouter } from './src/routes/index.js';
import configRoutes from './src/routes/configRoutes.js';
import { errorHandler } from './src/middleware/errorHandler.js';
import { logger } from './src/utils/logger.js';
import { initDatabase } from './src/utils/database.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: function (origin, callback) {
    const allowedOrigins = [
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:5175',
      process.env.FRONTEND_URL
    ].filter(Boolean);
    
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
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
  const useMockJira = process.env.USE_MOCK_JIRA === 'true' || 
                      process.env.NODE_ENV === 'demo' ||
                      (!process.env.ATLASSIAN_TOKEN && !process.env.JIRA_API_TOKEN);
  
  res.json({ 
    status: 'ok', 
    version: '1.0.0', 
    node: process.version,
    environment: {
      jira: useMockJira ? 'mock' : !!process.env.ATLASSIAN_URL,
      testRail: !!process.env.TESTRAIL_URL,
      gemini: !!(process.env.GOOGLE_API_KEY || process.env.GOOGLE_APPLICATION_CREDENTIALS),
      github: !!process.env.GITHUB_TOKEN,
      mockMode: useMockJira
    }
  });
});

// Test endpoint for mock data
app.get('/api/test-mock', async (req, res) => {
  const { MockJiraService } = await import('./src/services/mockJiraService.js');
  const mockService = new MockJiraService();
  const boards = await mockService.getBoards();
  res.json({
    message: 'Mock data test',
    boards: boards,
    boardCount: boards.length
  });
});

// API Routes
app.use('/api', apiRouter);
app.use('/api/config', configRoutes);

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
      logger.info(`🎭 Test mock data: http://localhost:${PORT}/api/test-mock`);
      
      // Check if we're in mock mode
      if (process.env.USE_MOCK_JIRA === 'true' || !process.env.ATLASSIAN_TOKEN) {
        logger.info('');
        logger.info('🎭 === RUNNING IN MOCK MODE ===');
        logger.info('Mock JIRA data will be used for demonstration');
        logger.info('This is perfect for the hackathon demo!');
        logger.info('=====================================');
      }
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
