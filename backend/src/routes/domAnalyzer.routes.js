import express from 'express';
import { domAnalyzerController } from '../controllers/domAnalyzerController.js';

const router = express.Router();

// Analyze DOM structure of a page
router.post('/analyze', domAnalyzerController.analyzePage.bind(domAnalyzerController));

// Generate test with actual DOM locators
router.post('/generate-test', domAnalyzerController.generateTestWithDom.bind(domAnalyzerController));

// Capture current page state
router.post('/capture-state', domAnalyzerController.capturePageState.bind(domAnalyzerController));

export default router;