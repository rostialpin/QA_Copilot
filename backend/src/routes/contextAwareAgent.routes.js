/**
 * Context-Aware Code Generation Agent Routes
 */

import { Router } from 'express';
import {
  generateMultiFileOutput,
  analyzeFiles,
  parseDataCategories
} from '../controllers/contextAwareAgentController.js';

const router = Router();

// Generate multi-file output (test class + page object updates + property updates)
router.post('/generate', generateMultiFileOutput);

// Analyze files without generating code
router.post('/analyze', analyzeFiles);

// Parse data categories file
router.post('/parse-categories', parseDataCategories);

export default router;
