/**
 * Context-Aware Code Generation Agent Controller
 *
 * Handles API requests for the multi-file code generation agent
 */

import { logger } from '../utils/logger.js';
import { contextAwareCodeGenerationAgent } from '../services/contextAwareCodeGenerationAgent.js';

/**
 * Generate multi-file output for a test scenario
 * POST /api/context-aware-agent/generate
 */
export async function generateMultiFileOutput(req, res) {
  try {
    const {
      testScenario,
      existingTestPaths,
      pageObjectPaths,
      propertyFilePaths,
      repositoryPath,
      // NEW: Hybrid RAG parameters
      hints,         // { similarTest, primaryScreen, template }
      useRAG         // true/false to force RAG on/off
    } = req.body;

    // Validate required fields
    if (!testScenario) {
      return res.status(400).json({
        success: false,
        error: 'testScenario is required'
      });
    }

    // Repository path optional if using RAG with indexed repo
    const hasManualFiles = (existingTestPaths?.length > 0) ||
                           (pageObjectPaths?.length > 0) ||
                           (propertyFilePaths?.length > 0);

    if (!repositoryPath && hasManualFiles) {
      return res.status(400).json({
        success: false,
        error: 'repositoryPath is required when providing manual file paths'
      });
    }

    logger.info('Context-Aware Agent: Starting multi-file generation');
    logger.info(`Test Scenario: ${testScenario.title || 'Untitled'}`);
    logger.info(`Mode: ${hasManualFiles ? 'Manual files' : 'RAG auto-retrieval'}`);
    if (hints) {
      logger.info(`User hints: ${JSON.stringify(hints)}`);
    }

    // Initialize and run the agent (with RAG support)
    await contextAwareCodeGenerationAgent.initialize({ enableRAG: true });

    const result = await contextAwareCodeGenerationAgent.generateMultiFileOutput({
      testScenario,
      existingTestPaths: existingTestPaths || [],
      pageObjectPaths: pageObjectPaths || [],
      propertyFilePaths: propertyFilePaths || [],
      repositoryPath,
      hints: hints || {},
      useRAG
    });

    res.json(result);

  } catch (error) {
    logger.error('Context-Aware Agent generation error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Analyze files without generating code
 * POST /api/context-aware-agent/analyze
 */
export async function analyzeFiles(req, res) {
  try {
    const {
      existingTestPaths,
      pageObjectPaths,
      propertyFilePaths,
      repositoryPath
    } = req.body;

    if (!repositoryPath) {
      return res.status(400).json({
        success: false,
        error: 'repositoryPath is required'
      });
    }

    logger.info('Context-Aware Agent: Analyzing files');

    await contextAwareCodeGenerationAgent.initialize();

    const analysis = await contextAwareCodeGenerationAgent.analyzeInputFiles({
      existingTestPaths: existingTestPaths || [],
      pageObjectPaths: pageObjectPaths || [],
      propertyFilePaths: propertyFilePaths || [],
      repositoryPath
    });

    // Prepare summary
    const summary = {
      success: true,
      methodCount: analysis.existingMethods.length,
      elementCount: analysis.existingElements.length,
      screens: Object.keys(analysis.methodsByScreen),
      propertyFiles: Object.keys(analysis.elementsByScreen),
      testPatterns: analysis.testPatterns.length,
      baseClasses: Array.from(analysis.baseClasses),
      commonImports: Array.from(analysis.commonImports).slice(0, 20)
    };

    // Include detailed method list
    summary.methodsByScreen = {};
    for (const [screen, info] of Object.entries(analysis.methodsByScreen)) {
      summary.methodsByScreen[screen] = {
        className: info.className,
        methodCount: info.methods.length,
        methods: info.methods.map(m => ({
          name: m.name,
          returnType: m.returnType,
          parameters: m.parameters
        }))
      };
    }

    // Include element list
    summary.elementsByScreen = {};
    for (const [screen, info] of Object.entries(analysis.elementsByScreen)) {
      summary.elementsByScreen[screen] = {
        elementCount: Object.keys(info.elements).length,
        elements: Object.keys(info.elements)
      };
    }

    res.json(summary);

  } catch (error) {
    logger.error('Context-Aware Agent analysis error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Parse data categories file
 * POST /api/context-aware-agent/parse-categories
 */
export async function parseDataCategories(req, res) {
  try {
    const { filePath, repositoryPath } = req.body;

    if (!filePath) {
      return res.status(400).json({
        success: false,
        error: 'filePath is required'
      });
    }

    const fs = await import('fs/promises');
    const content = await fs.readFile(filePath, 'utf8');

    // Parse the categories file format
    const categories = parseCategoriesFile(content);

    res.json({
      success: true,
      categories,
      summary: {
        testCount: categories.tests.length,
        pageObjectCount: categories.pageObjects.length,
        propertyCount: categories.properties.length,
        templates: categories.templates
      }
    });

  } catch (error) {
    logger.error('Parse categories error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Parse the categories file format
 */
function parseCategoriesFile(content) {
  const categories = {
    tests: [],
    pageObjects: [],
    properties: [],
    templates: []
  };

  const lines = content.split('\n');
  let currentCategory = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const lowerTrimmed = trimmed.toLowerCase();

    // Detect category headers
    if (lowerTrimmed.includes('categry 1') || lowerTrimmed.includes('category 1') ||
        (lowerTrimmed.includes('tests') && lowerTrimmed.includes(':'))) {
      currentCategory = 'tests';
      // Check if same line has content after colon
      const afterColon = trimmed.split(':').slice(1).join(':').trim();
      if (afterColon) {
        parseAndAddPaths(afterColon, categories, 'tests');
      }
      continue;
    }

    if (lowerTrimmed.includes('category 2') || lowerTrimmed.includes('page object')) {
      currentCategory = 'pageObjects';
      continue;
    }

    if (lowerTrimmed.includes('category 3') ||
        (lowerTrimmed.includes('properties') && lowerTrimmed.includes('file'))) {
      currentCategory = 'properties';
      continue;
    }

    if (lowerTrimmed.includes('quick templates') || lowerTrimmed.includes('templates:')) {
      currentCategory = 'templates';
      continue;
    }

    // Parse file paths (comma-separated or one per line)
    if (currentCategory && trimmed) {
      parseAndAddPaths(trimmed, categories, currentCategory);
    }
  }

  return categories;
}

function parseAndAddPaths(text, categories, category) {
  const paths = text.split(',').map(p => p.trim()).filter(p => p);

  for (const path of paths) {
    if (path.endsWith('.java')) {
      categories[category].push(path);
    } else if (path.endsWith('.properties')) {
      categories.properties.push(path);
    } else if (category === 'templates' && path.length > 0 && !path.includes('/')) {
      categories.templates.push(path);
    }
  }
}

export default {
  generateMultiFileOutput,
  analyzeFiles,
  parseDataCategories
};
