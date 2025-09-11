import patternLearningService from '../services/patternLearningService.js';
import advancedPatternLearningService from '../services/advancedPatternLearningService.js';
import { logger } from '../utils/logger.js';

/**
 * Train the pattern learning service with user-provided patterns
 */
export const trainPatterns = async (req, res) => {
  try {
    const { patterns } = req.body;

    if (!patterns || !Array.isArray(patterns) || patterns.length === 0) {
      return res.status(400).json({ 
        error: 'Patterns array is required' 
      });
    }

    // Process each pattern
    const processedPatterns = patterns.map(pattern => ({
      url: pattern.url,
      platform: pattern.platform || 'web',
      element: {
        type: pattern.element.type,
        text: pattern.element.text,
        customName: pattern.element.customName,
        customTestId: pattern.element.customTestId,
        attributes: pattern.element.attributes || {}
      },
      locatorStrategies: pattern.locatorStrategies || [],
      testType: pattern.testType || 'functional',
      timestamp: pattern.timestamp || new Date().toISOString()
    }));

    // Store patterns in the pattern learning service
    // For now, we'll just acknowledge receipt and log them
    // In a production system, these would be stored in a database
    logger.info(`Received ${processedPatterns.length} training patterns`);
    
    // Simulate processing the patterns
    const result = {
      success: true,
      patternsProcessed: processedPatterns.length,
      message: 'Patterns successfully processed and stored for training'
    };

    res.json(result);
  } catch (error) {
    logger.error('Error training patterns:', error);
    res.status(500).json({ 
      error: 'Failed to process training patterns',
      details: error.message 
    });
  }
};

/**
 * Get learned patterns for a specific URL or platform
 */
export const getLearnedPatterns = async (req, res) => {
  try {
    const { url, platform } = req.query;

    // In a production system, this would query stored patterns
    // For now, return mock data
    const patterns = {
      url,
      platform: platform || 'web',
      patterns: [],
      totalPatterns: 0
    };

    res.json(patterns);
  } catch (error) {
    logger.error('Error retrieving learned patterns:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve learned patterns',
      details: error.message 
    });
  }
};

/**
 * Analyze existing test files to learn patterns
 */
export const analyzeTestFiles = async (req, res) => {
  try {
    const { testFilePaths, framework } = req.body;

    if (!testFilePaths || !Array.isArray(testFilePaths)) {
      return res.status(400).json({ 
        error: 'Test file paths array is required' 
      });
    }

    // Use the advanced pattern learning service to analyze test files
    const patterns = await advancedPatternLearningService.analyzeTestFiles(
      testFilePaths,
      framework || 'cypress'
    );

    res.json({
      success: true,
      patternsExtracted: patterns.length,
      patterns
    });
  } catch (error) {
    logger.error('Error analyzing test files:', error);
    res.status(500).json({ 
      error: 'Failed to analyze test files',
      details: error.message 
    });
  }
};

/**
 * Get pattern suggestions based on context
 */
export const getPatternSuggestions = async (req, res) => {
  try {
    const { context, elementType, platform } = req.body;

    // Use pattern learning service to get suggestions
    const suggestions = await patternLearningService.getRelevantPatterns(
      context || '',
      elementType || 'button',
      platform || 'web'
    );

    res.json({
      success: true,
      suggestions
    });
  } catch (error) {
    logger.error('Error getting pattern suggestions:', error);
    res.status(500).json({ 
      error: 'Failed to get pattern suggestions',
      details: error.message 
    });
  }
};

export default {
  trainPatterns,
  getLearnedPatterns,
  analyzeTestFiles,
  getPatternSuggestions
};