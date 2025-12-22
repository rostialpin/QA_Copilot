/**
 * Multi-Agent Test Generation Routes
 *
 * Unified API for the complete multi-agent test generation pipeline:
 * 1. Scenario Decomposer → Break down scenario into steps
 * 2. Action Mapper → Map steps to actual methods
 * 3. Prerequisite Builder → Build navigation and setup
 * 4. Test Composer → Generate complete test class
 *
 * Also provides individual agent endpoints for debugging/testing.
 */

import { Router } from 'express';
import { scenarioDecomposerAgent } from '../agents/scenarioDecomposerAgent.js';
import { actionMapperAgent } from '../agents/actionMapperAgent.js';
import { prerequisiteBuilderAgent } from '../agents/prerequisiteBuilderAgent.js';
import { testComposerAgent } from '../agents/testComposerAgent.js';
import { componentGeneratorAgent } from '../agents/componentGeneratorAgent.js';
import { logger } from '../utils/logger.js';

const router = Router();

// ============ Full Pipeline ============

/**
 * Generate a complete test from a natural language scenario
 * POST /api/multi-agent/generate
 *
 * This is the main entry point that runs all agents in sequence.
 *
 * Body:
 * - scenario: string (required) - Natural language test scenario
 * - platform: string (optional) - Target platform (ctv, mobile, web)
 * - brand: string (optional) - Target brand (pplus, plutotv)
 * - includeLogin: boolean (optional) - Force include/exclude login
 * - testType: string (optional) - Test type (functional, smoke, e2e)
 * - className: string (optional) - Override generated class name
 * - packageName: string (optional) - Override package name
 */
router.post('/generate', async (req, res) => {
  const startTime = Date.now();

  try {
    const {
      scenario,
      platform,
      brand,
      includeLogin = true,
      testType = 'functional',
      className,
      packageName,
      debug = false
    } = req.body;

    if (!scenario) {
      return res.status(400).json({
        success: false,
        error: 'scenario is required'
      });
    }

    logger.info(`Multi-agent generation started for: "${scenario.substring(0, 50)}..."`);

    // Initialize agents if needed
    await initializeAgents();

    const pipelineResults = {
      input: { scenario, platform, brand },
      stages: {}
    };

    // ========== STAGE 1: Decompose Scenario ==========
    logger.debug('Stage 1: Scenario Decomposition');
    const decomposition = await scenarioDecomposerAgent.decompose(scenario, {
      platform,
      brand,
      includeLogin
    });

    if (!decomposition.success) {
      return res.status(500).json({
        success: false,
        error: 'Scenario decomposition failed',
        details: decomposition.error,
        stage: 'decomposition'
      });
    }

    pipelineResults.stages.decomposition = {
      success: true,
      stepsCount: decomposition.steps?.length || 0,
      method: decomposition.decomposition_method,
      learnedPatternsUsed: decomposition.learned_patterns_used || 0
    };

    // ========== STAGE 2: Map Actions to Methods ==========
    logger.debug('Stage 2: Action Mapping');
    const mappingResult = await actionMapperAgent.mapSteps(decomposition, {
      platform,
      brand
    });

    if (!mappingResult.success) {
      return res.status(500).json({
        success: false,
        error: 'Action mapping failed',
        details: mappingResult.error,
        stage: 'mapping',
        decomposition: debug ? decomposition : undefined
      });
    }

    pipelineResults.stages.mapping = {
      success: true,
      mapped: mappingResult.statistics?.mapped || 0,
      unmapped: mappingResult.statistics?.unmapped || 0,
      mappingRate: mappingResult.statistics?.mappingRate,
      averageConfidence: mappingResult.statistics?.averageConfidence
    };

    // ========== STAGE 3: Build Prerequisites ==========
    logger.debug('Stage 3: Prerequisite Building');
    const prerequisites = await prerequisiteBuilderAgent.buildPrerequisites(
      mappingResult,
      {
        platform,
        brand,
        includeLogin,
        targetScreen: decomposition.primary_screen || decomposition.primaryScreen
      }
    );

    if (!prerequisites.success) {
      return res.status(500).json({
        success: false,
        error: 'Prerequisite building failed',
        details: prerequisites.error,
        stage: 'prerequisites',
        decomposition: debug ? decomposition : undefined,
        mapping: debug ? mappingResult : undefined
      });
    }

    pipelineResults.stages.prerequisites = {
      success: true,
      targetScreen: prerequisites.targetScreen,
      screensInPath: prerequisites.screenChain?.length || 0,
      importsCount: prerequisites.prerequisites?.imports?.length || 0
    };

    // ========== STAGE 4: Compose Test ==========
    logger.debug('Stage 4: Test Composition');
    const composedTest = await testComposerAgent.composeTest(
      { title: scenario, description: '' },
      decomposition,
      mappingResult,
      prerequisites,
      {
        className,
        packageName,
        platform,
        brand,
        testType
      }
    );

    if (!composedTest.success) {
      return res.status(500).json({
        success: false,
        error: 'Test composition failed',
        details: composedTest.error,
        stage: 'composition',
        decomposition: debug ? decomposition : undefined,
        mapping: debug ? mappingResult : undefined,
        prerequisites: debug ? prerequisites : undefined
      });
    }

    pipelineResults.stages.composition = {
      success: true,
      className: composedTest.className,
      linesOfCode: composedTest.code.split('\n').length,
      warnings: composedTest.warnings?.length || 0
    };

    // ========== STAGE 5: Generate Components for Unmapped Actions ==========
    let generatedComponents = null;
    if (mappingResult.unmapped && mappingResult.unmapped.length > 0) {
      logger.debug('Stage 5: Component Generation');
      try {
        await componentGeneratorAgent.initialize();
        generatedComponents = await componentGeneratorAgent.generateComponents(
          mappingResult.unmapped,
          {
            platform,
            brand,
            targetScreen: prerequisites.targetScreen
          }
        );

        pipelineResults.stages.componentGeneration = {
          success: true,
          methodsGenerated: generatedComponents.newMethods?.length || 0,
          locatorsGenerated: generatedComponents.newLocators?.length || 0,
          propertiesGenerated: generatedComponents.newProperties?.length || 0
        };
      } catch (error) {
        logger.warn(`Component generation failed: ${error.message}`);
        pipelineResults.stages.componentGeneration = {
          success: false,
          error: error.message
        };
      }
    }

    // Calculate total time
    const totalTime = Date.now() - startTime;

    logger.info(`Multi-agent generation completed in ${totalTime}ms`);

    // Return results
    res.json({
      success: true,
      code: composedTest.code,
      className: composedTest.className,
      fullClassName: composedTest.fullClassName,
      metadata: composedTest.metadata,
      warnings: composedTest.warnings,
      unmappedActions: composedTest.unmappedActions,
      generatedComponents: generatedComponents ? {
        newMethods: generatedComponents.newMethods,
        newProperties: generatedComponents.newProperties,
        newLocators: generatedComponents.newLocators,
        statistics: generatedComponents.statistics
      } : null,
      pipeline: pipelineResults,
      timing: {
        totalMs: totalTime
      },
      // Debug info (if requested)
      debug: debug ? {
        decomposition,
        mapping: mappingResult,
        prerequisites,
        generatedComponents
      } : undefined
    });

  } catch (error) {
    logger.error('Multi-agent generation error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stage: 'unknown'
    });
  }
});

/**
 * Get pipeline status and capabilities
 * GET /api/multi-agent/info
 */
router.get('/info', (req, res) => {
  res.json({
    success: true,
    pipeline: 'Multi-Agent Test Generation',
    version: '1.0.0',
    agents: [
      {
        name: 'ScenarioDecomposerAgent',
        role: 'Break down natural language scenarios into atomic steps',
        features: ['rules-first', 'ai-learning', 'pattern-reuse']
      },
      {
        name: 'ActionMapperAgent',
        role: 'Map steps to actual code methods',
        features: ['knowledge-base-lookup', 'semantic-search', 'learning']
      },
      {
        name: 'PrerequisiteBuilderAgent',
        role: 'Build navigation paths and setup code',
        features: ['screen-graph', 'import-collection', 'data-requirements']
      },
      {
        name: 'TestComposerAgent',
        role: 'Assemble complete test classes',
        features: ['testng-annotations', 'javadoc', 'code-formatting']
      },
      {
        name: 'ComponentGeneratorAgent',
        role: 'Generate new methods and locators for unmapped actions',
        features: ['smart-locators', 'pattern-learning', 'multi-platform']
      }
    ],
    supportedPlatforms: ['ctv', 'mobile', 'web', 'html5', 'hdmi'],
    supportedBrands: ['pplus', 'plutotv']
  });
});

// ============ Individual Agent Endpoints ============

/**
 * Action Mapper - Map steps to methods
 * POST /api/multi-agent/map
 */
router.post('/map', async (req, res) => {
  try {
    const { decomposition, platform, brand } = req.body;

    if (!decomposition || !decomposition.steps) {
      return res.status(400).json({
        success: false,
        error: 'decomposition with steps is required'
      });
    }

    await actionMapperAgent.initialize();
    const result = await actionMapperAgent.mapSteps(decomposition, { platform, brand });

    res.json(result);
  } catch (error) {
    logger.error('Action mapping error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Prerequisite Builder - Build prerequisites
 * POST /api/multi-agent/prerequisites
 */
router.post('/prerequisites', async (req, res) => {
  try {
    const { mappingResult, platform, brand, includeLogin, targetScreen } = req.body;

    if (!mappingResult) {
      return res.status(400).json({
        success: false,
        error: 'mappingResult is required'
      });
    }

    await prerequisiteBuilderAgent.initialize();
    const result = await prerequisiteBuilderAgent.buildPrerequisites(mappingResult, {
      platform,
      brand,
      includeLogin,
      targetScreen
    });

    res.json(result);
  } catch (error) {
    logger.error('Prerequisite building error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Test Composer - Compose test class
 * POST /api/multi-agent/compose
 */
router.post('/compose', async (req, res) => {
  try {
    const {
      scenario,
      decomposition,
      mappingResult,
      prerequisites,
      className,
      packageName,
      platform,
      brand,
      testType
    } = req.body;

    if (!scenario || !decomposition || !mappingResult || !prerequisites) {
      return res.status(400).json({
        success: false,
        error: 'scenario, decomposition, mappingResult, and prerequisites are required'
      });
    }

    await testComposerAgent.initialize();
    const result = await testComposerAgent.composeTest(
      scenario,
      decomposition,
      mappingResult,
      prerequisites,
      { className, packageName, platform, brand, testType }
    );

    res.json(result);
  } catch (error) {
    logger.error('Test composition error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Component Generator - Generate code for unmapped actions
 * POST /api/multi-agent/generate-components
 */
router.post('/generate-components', async (req, res) => {
  try {
    const { unmappedActions, platform, brand, targetScreen } = req.body;

    if (!unmappedActions || !Array.isArray(unmappedActions)) {
      return res.status(400).json({
        success: false,
        error: 'unmappedActions array is required'
      });
    }

    await componentGeneratorAgent.initialize();
    const result = await componentGeneratorAgent.generateComponents(
      unmappedActions,
      { platform, brand, targetScreen }
    );

    // Also return formatted code
    if (result.success) {
      result.formattedJavaCode = componentGeneratorAgent.formatAsJavaCode(result);
      result.formattedProperties = componentGeneratorAgent.formatAsProperties(result);
    }

    res.json(result);
  } catch (error) {
    logger.error('Component generation error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Initialize all agents
 * POST /api/multi-agent/initialize
 */
router.post('/initialize', async (req, res) => {
  try {
    await initializeAgents();
    res.json({
      success: true,
      message: 'All agents initialized',
      agents: ['ScenarioDecomposer', 'ActionMapper', 'PrerequisiteBuilder', 'TestComposer', 'ComponentGenerator']
    });
  } catch (error) {
    logger.error('Agent initialization error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get agent statistics
 * GET /api/multi-agent/stats
 */
router.get('/stats', async (req, res) => {
  try {
    res.json({
      success: true,
      agents: {
        scenarioDecomposer: scenarioDecomposerAgent.getStats ? scenarioDecomposerAgent.getStats() : {},
        actionMapper: actionMapperAgent.getStats(),
        prerequisiteBuilder: prerequisiteBuilderAgent.getStats(),
        testComposer: testComposerAgent.getStats(),
        componentGenerator: componentGeneratorAgent.getStats()
      }
    });
  } catch (error) {
    logger.error('Stats error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Helper function to initialize all agents
async function initializeAgents() {
  await Promise.all([
    scenarioDecomposerAgent.initialize ? scenarioDecomposerAgent.initialize() : Promise.resolve(),
    actionMapperAgent.initialize(),
    prerequisiteBuilderAgent.initialize(),
    testComposerAgent.initialize(),
    componentGeneratorAgent.initialize()
  ]);
}

export default router;
