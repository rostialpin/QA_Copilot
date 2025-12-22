/**
 * Scenario Decomposer Agent Routes
 *
 * Endpoints for decomposing test scenarios into atomic steps
 */

import { Router } from 'express';
import { scenarioDecomposerAgent } from '../agents/scenarioDecomposerAgent.js';
import { logger } from '../utils/logger.js';

const router = Router();

/**
 * Initialize the agent
 * POST /api/scenario-decomposer/initialize
 */
router.post('/initialize', async (req, res) => {
  try {
    await scenarioDecomposerAgent.initialize();
    res.json({
      success: true,
      message: 'Scenario Decomposer Agent initialized'
    });
  } catch (error) {
    logger.error('Scenario Decomposer initialization error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Decompose a test scenario into atomic steps
 * POST /api/scenario-decomposer/decompose
 *
 * Body:
 * - scenario: string (required) - Natural language test scenario
 * - platform: string (optional) - Target platform (ctv, mobile, web)
 * - brand: string (optional) - Target brand (pplus, plutotv)
 * - includeLogin: boolean (optional) - Force include/exclude login step
 * - forceAI: boolean (optional) - Force AI even if rules are confident
 * - confidenceThreshold: number (optional) - Min confidence for rules (0-1, default 0.7)
 *
 * How it works:
 * 1. Rules (enhanced with learned patterns) - FREE
 * 2. AI (only if rules not confident) - COSTS TOKENS, but patterns are learned permanently
 */
router.post('/decompose', async (req, res) => {
  try {
    const { scenario, platform, brand, includeLogin, forceAI, confidenceThreshold } = req.body;

    if (!scenario) {
      return res.status(400).json({
        success: false,
        error: 'scenario is required'
      });
    }

    // Initialize if not already done
    if (!scenarioDecomposerAgent.openRouterService) {
      await scenarioDecomposerAgent.initialize();
    }

    const result = await scenarioDecomposerAgent.decompose(scenario, {
      platform,
      brand,
      includeLogin,
      forceAI,
      confidenceThreshold
    });

    res.json(result);
  } catch (error) {
    logger.error('Scenario decomposition error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Decompose multiple scenarios in batch
 * POST /api/scenario-decomposer/decompose-batch
 *
 * Body:
 * - scenarios: string[] (required) - Array of test scenarios
 * - platform: string (optional) - Target platform for all
 * - brand: string (optional) - Target brand for all
 */
router.post('/decompose-batch', async (req, res) => {
  try {
    const { scenarios, platform, brand } = req.body;

    if (!scenarios || !Array.isArray(scenarios) || scenarios.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'scenarios array is required'
      });
    }

    // Initialize if not already done
    if (!scenarioDecomposerAgent.openRouterService) {
      await scenarioDecomposerAgent.initialize();
    }

    const results = [];
    for (const scenario of scenarios) {
      const result = await scenarioDecomposerAgent.decompose(scenario, {
        platform,
        brand
      });
      results.push({
        scenario: scenario.substring(0, 100),
        ...result
      });
    }

    res.json({
      success: true,
      count: results.length,
      results
    });
  } catch (error) {
    logger.error('Batch decomposition error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Validate decomposed steps for logical consistency
 * POST /api/scenario-decomposer/validate
 *
 * Body:
 * - steps: array (required) - Steps to validate
 */
router.post('/validate', async (req, res) => {
  try {
    const { steps } = req.body;

    if (!steps || !Array.isArray(steps)) {
      return res.status(400).json({
        success: false,
        error: 'steps array is required'
      });
    }

    const validation = scenarioDecomposerAgent.validateSteps(steps);
    res.json({
      success: true,
      ...validation
    });
  } catch (error) {
    logger.error('Validation error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get agent configuration and capabilities
 * GET /api/scenario-decomposer/info
 */
router.get('/info', (req, res) => {
  res.json({
    success: true,
    agent: 'ScenarioDecomposerAgent',
    version: '1.0.0',
    model: scenarioDecomposerAgent.model,
    capabilities: {
      standardActions: scenarioDecomposerAgent.standardActions,
      testTypes: Object.keys(scenarioDecomposerAgent.testTypeKeywords),
      platforms: ['ctv', 'mobile', 'web']
    }
  });
});

export default router;
