import express from 'express';
import javaSeleniumController from '../controllers/javaSeleniumController.js';

const router = express.Router();

// Validate repository
router.post('/validate', javaSeleniumController.validateRepository);

// Get directory tree for browsing
router.get('/directory-tree', javaSeleniumController.getDirectoryTree);

// Index repository
router.post('/index', javaSeleniumController.indexRepository);

// Learn patterns from directory
router.post('/learn-patterns', javaSeleniumController.learnPatterns);

// Generate Selenium test (legacy)
router.post('/generate', javaSeleniumController.generateTest);

// Generate Selenium test with Gemini AI
router.post('/generate-with-gemini', javaSeleniumController.generateTestWithGemini);

// Save generated test
router.post('/save', javaSeleniumController.saveTest);

// Open in IDE
router.post('/open-ide', javaSeleniumController.openInIDE);

// Enhanced generation with DOM and properties
router.post('/generate-enhanced', javaSeleniumController.generateEnhancedTest);

// Learn from properties files
router.post('/learn-properties', javaSeleniumController.learnFromProperties);

// Test DOM analysis
router.post('/test-dom-analysis', javaSeleniumController.testDomAnalysis);

export default router;