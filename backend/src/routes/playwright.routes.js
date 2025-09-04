import express from 'express';
import {
  validateRepository,
  getDirectoryTree,
  learnPatterns,
  generateTest,
  saveTest,
  openInIDE
} from '../controllers/playwrightController.js';

const router = express.Router();

// Validate repository
router.post('/validate', validateRepository);

// Get directory tree
router.get('/directory-tree', getDirectoryTree);

// Learn patterns from existing tests
router.post('/learn-patterns', learnPatterns);

// Generate Playwright test
router.post('/generate', generateTest);

// Save generated test
router.post('/save', saveTest);

// Open file in IDE
router.post('/open-ide', openInIDE);

export default router;