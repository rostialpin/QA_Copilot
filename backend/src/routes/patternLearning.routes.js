import express from 'express';
import {
  trainPatterns,
  getLearnedPatterns,
  analyzeTestFiles,
  getPatternSuggestions
} from '../controllers/patternLearningController.js';

export const patternLearningRouter = express.Router();

// Train patterns with user-provided data
patternLearningRouter.post('/train', trainPatterns);

// Get learned patterns for a URL/platform
patternLearningRouter.get('/patterns', getLearnedPatterns);

// Analyze existing test files to learn patterns
patternLearningRouter.post('/analyze-tests', analyzeTestFiles);

// Get pattern suggestions based on context
patternLearningRouter.post('/suggestions', getPatternSuggestions);

export default patternLearningRouter;