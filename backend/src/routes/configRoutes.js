import express from 'express';
import { logger } from '../utils/logger.js';

const router = express.Router();

// Get current configuration status
router.get('/status', (req, res) => {
  const config = {
    jira: {
      configured: !!(process.env.JIRA_HOST && process.env.JIRA_EMAIL && process.env.JIRA_API_TOKEN),
      host: process.env.JIRA_HOST || 'Not configured',
      email: process.env.JIRA_EMAIL || 'Not configured'
    },
    testrail: {
      configured: !!(process.env.TESTRAIL_HOST && process.env.TESTRAIL_USERNAME && process.env.TESTRAIL_API_KEY),
      host: process.env.TESTRAIL_HOST || 'Not configured'
    },
    gemini: {
      configured: !!process.env.GEMINI_API_KEY
    }
  };
  
  res.json(config);
});

// Mock mode removed - only real JIRA

// Update JIRA credentials
router.post('/jira/credentials', (req, res) => {
  const { host, email, apiToken } = req.body;
  
  if (!host || !email || !apiToken) {
    return res.status(400).json({
      success: false,
      message: 'host, email, and apiToken are required'
    });
  }
  
  // Update environment variables (only for this session)
  process.env.JIRA_HOST = host;
  process.env.JIRA_EMAIL = email;
  process.env.JIRA_API_TOKEN = apiToken;
  
  logger.info(`JIRA credentials updated for ${host}`);
  
  res.json({
    success: true,
    message: 'JIRA credentials updated successfully',
    host,
    email
  });
});

export default router;