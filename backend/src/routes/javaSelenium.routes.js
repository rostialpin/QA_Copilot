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

// Generate Selenium test
router.post('/generate', javaSeleniumController.generateTest);

// Save generated test
router.post('/save', javaSeleniumController.saveTest);

// Open in IDE
router.post('/open-ide', javaSeleniumController.openInIDE);

export default router;