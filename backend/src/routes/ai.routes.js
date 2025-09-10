import express from 'express';
import { aiController } from '../controllers/aiController.js';

const router = express.Router();

// Get AI service status
router.get('/status', aiController.getStatus);

// Set AI provider (gemini or claude)
router.post('/provider', aiController.setProvider);

// Set AI model
router.post('/model', aiController.setModel);

// Generate test cases
router.post('/generate-test-cases', aiController.generateTestCases);

// Compare providers
router.post('/compare-providers', aiController.compareProviders);

// Generate Cypress test
router.post('/generate-cypress', aiController.generateCypressTest);

// Generate Selenium test
router.post('/generate-selenium', aiController.generateSeleniumTest);

export default router;