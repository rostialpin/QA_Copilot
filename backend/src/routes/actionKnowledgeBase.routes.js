/**
 * Action Knowledge Base Routes
 *
 * Endpoints for managing the 3-layer action knowledge base:
 * - Layer 1: Atomic Actions (method-level mappings)
 * - Layer 2: Composite Actions (action chains)
 * - Layer 3: User Terminology (learned terms)
 */

import { Router } from 'express';
import { actionKnowledgeBaseService } from '../services/actionKnowledgeBaseService.js';
import { logger } from '../utils/logger.js';

const router = Router();

// ============ Initialization & Stats ============

/**
 * Initialize the Action Knowledge Base
 * POST /api/knowledge-base/initialize
 */
router.post('/initialize', async (req, res) => {
  try {
    const { chromaHost } = req.body;
    const success = await actionKnowledgeBaseService.initialize(chromaHost);

    res.json({
      success,
      message: success ? 'Action Knowledge Base initialized' : 'Failed to initialize'
    });
  } catch (error) {
    logger.error('Knowledge Base initialization error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get statistics for all collections
 * GET /api/knowledge-base/stats
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await actionKnowledgeBaseService.getStats();
    res.json({ success: true, stats });
  } catch (error) {
    logger.error('Stats error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Clear all collections (for re-indexing)
 * DELETE /api/knowledge-base/all
 */
router.delete('/all', async (req, res) => {
  try {
    const result = await actionKnowledgeBaseService.clearAll();
    res.json(result);
  } catch (error) {
    logger.error('Clear all error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============ Repository Mining ============

/**
 * Index methods from a repository into atomic actions
 * POST /api/knowledge-base/index-methods
 *
 * Body:
 * - repositoryPath: string (required) - Path to the repository
 */
router.post('/index-methods', async (req, res) => {
  try {
    const { repositoryPath } = req.body;

    if (!repositoryPath) {
      return res.status(400).json({
        success: false,
        error: 'repositoryPath is required'
      });
    }

    logger.info(`Mining methods from repository: ${repositoryPath}`);
    const result = await actionKnowledgeBaseService.indexMethodsFromRepository(repositoryPath);

    res.json(result);
  } catch (error) {
    logger.error('Method indexing error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============ Layer 1: Atomic Actions ============

/**
 * Add an atomic action
 * POST /api/knowledge-base/atomic-actions
 *
 * Body: AtomicAction object
 */
router.post('/atomic-actions', async (req, res) => {
  try {
    const action = req.body;

    if (!action.actionName || !action.methodName || !action.className) {
      return res.status(400).json({
        success: false,
        error: 'actionName, methodName, and className are required'
      });
    }

    // Generate ID if not provided (include actionName for uniqueness)
    if (!action.id) {
      const idParts = ['action'];
      if (action.platform) idParts.push(action.platform);
      if (action.brand) idParts.push(action.brand);
      // Include actionName to allow multiple patterns pointing to same method
      if (action.actionName) idParts.push(action.actionName);
      idParts.push(action.className, action.methodName);
      action.id = idParts.join('_');
    }

    const result = await actionKnowledgeBaseService.addAtomicAction(action);
    res.json(result);
  } catch (error) {
    logger.error('Add atomic action error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Find atomic action by semantic search
 * POST /api/knowledge-base/atomic-actions/search
 *
 * Body:
 * - query: string (required) - Action to search for
 * - targetScreen: string (optional) - Filter by screen
 * - platform: string (optional) - Filter by platform (ctv, mobile, web, html5, hdmi)
 * - brand: string (optional) - Filter by brand (pplus, plutotv)
 * - topK: number (optional) - Number of results (default: 5)
 */
router.post('/atomic-actions/search', async (req, res) => {
  try {
    const { query, targetScreen, platform, brand, topK } = req.body;

    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'query is required'
      });
    }

    const result = await actionKnowledgeBaseService.findAtomicAction(
      query,
      { targetScreen, platform, brand },
      topK || 5
    );

    res.json({ success: true, ...result });
  } catch (error) {
    logger.error('Find atomic action error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Enrich keywords for an atomic action
 * POST /api/knowledge-base/atomic-actions/:actionId/keywords
 *
 * Body:
 * - keywords: string[] (required) - New keywords to add
 */
router.post('/atomic-actions/:actionId/keywords', async (req, res) => {
  try {
    const { actionId } = req.params;
    const { keywords } = req.body;

    if (!keywords || !Array.isArray(keywords)) {
      return res.status(400).json({
        success: false,
        error: 'keywords array is required'
      });
    }

    const result = await actionKnowledgeBaseService.enrichKeywords(actionId, keywords);
    res.json(result);
  } catch (error) {
    logger.error('Enrich keywords error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get all atomic actions (for debugging/export)
 * GET /api/knowledge-base/atomic-actions
 */
router.get('/atomic-actions', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const result = await actionKnowledgeBaseService.getAllFromCollection('atomicActions', limit);
    res.json(result);
  } catch (error) {
    logger.error('Get atomic actions error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Delete an atomic action by ID
 * DELETE /api/knowledge-base/atomic-actions/:id
 */
router.delete('/atomic-actions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ success: false, error: 'id is required' });
    }

    const result = await actionKnowledgeBaseService.deleteFromCollection('atomicActions', id);
    res.json(result);
  } catch (error) {
    logger.error('Delete atomic action error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============ Layer 2: Composite Actions ============

/**
 * Add a composite action (action chain)
 * POST /api/knowledge-base/composite-actions
 *
 * Body:
 * - actionName: string (required)
 * - description: string (required)
 * - steps: array (required) - Array of step objects
 *   - order: number
 *   - atomicAction: string
 *   - parameters: object (optional)
 *   - conditional: boolean (optional)
 * - prerequisites: string[] (optional)
 * - targetScreen: string (optional)
 */
router.post('/composite-actions', async (req, res) => {
  try {
    const composite = req.body;

    if (!composite.actionName || !composite.description || !composite.steps) {
      return res.status(400).json({
        success: false,
        error: 'actionName, description, and steps are required'
      });
    }

    // Generate ID if not provided
    if (!composite.id) {
      composite.id = `composite_${composite.actionName}_${Date.now()}`;
    }

    const result = await actionKnowledgeBaseService.addCompositeAction(composite);
    res.json(result);
  } catch (error) {
    logger.error('Add composite action error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Find composite action by semantic search
 * POST /api/knowledge-base/composite-actions/search
 *
 * Body:
 * - query: string (required)
 * - topK: number (optional)
 */
router.post('/composite-actions/search', async (req, res) => {
  try {
    const { query, topK } = req.body;

    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'query is required'
      });
    }

    const result = await actionKnowledgeBaseService.findCompositeAction(query, topK || 3);
    res.json({ success: true, ...result });
  } catch (error) {
    logger.error('Find composite action error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Expand a composite action to atomic steps
 * GET /api/knowledge-base/composite-actions/:compositeId/expand
 */
router.get('/composite-actions/:compositeId/expand', async (req, res) => {
  try {
    const { compositeId } = req.params;
    const result = await actionKnowledgeBaseService.expandCompositeAction(compositeId);
    res.json(result);
  } catch (error) {
    logger.error('Expand composite action error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get all composite actions
 * GET /api/knowledge-base/composite-actions
 */
router.get('/composite-actions', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const result = await actionKnowledgeBaseService.getAllFromCollection('compositeActions', limit);
    res.json(result);
  } catch (error) {
    logger.error('Get composite actions error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Delete a composite action by ID
 * DELETE /api/knowledge-base/composite-actions/:id
 */
router.delete('/composite-actions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ success: false, error: 'id is required' });
    }

    const result = await actionKnowledgeBaseService.deleteFromCollection('compositeActions', id);
    res.json(result);
  } catch (error) {
    logger.error('Delete composite action error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============ Layer 3: User Terminology ============

/**
 * Translate a user term to actions
 * POST /api/knowledge-base/translate
 *
 * Body:
 * - term: string (required) - User's natural language term
 */
router.post('/translate', async (req, res) => {
  try {
    const { term } = req.body;

    if (!term) {
      return res.status(400).json({
        success: false,
        error: 'term is required'
      });
    }

    const result = await actionKnowledgeBaseService.translateUserTerm(term);
    res.json({ success: true, ...result });
  } catch (error) {
    logger.error('Translate term error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Learn new terminology from user
 * POST /api/knowledge-base/learn
 *
 * Body:
 * - term: string (required) - User's term
 * - expandsTo: string[] (required) - Actions it maps to
 * - context: string (optional) - When this term is used
 * - synonyms: string[] (optional) - Alternative ways to say it
 */
router.post('/learn', async (req, res) => {
  try {
    const { term, expandsTo, context, synonyms } = req.body;

    if (!term || !expandsTo || !Array.isArray(expandsTo)) {
      return res.status(400).json({
        success: false,
        error: 'term and expandsTo array are required'
      });
    }

    const result = await actionKnowledgeBaseService.learnFromUser(
      term,
      expandsTo,
      context || '',
      synonyms || []
    );

    res.json(result);
  } catch (error) {
    logger.error('Learn terminology error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Add synonym to existing terminology
 * POST /api/knowledge-base/terminology/:termId/synonyms
 *
 * Body:
 * - synonym: string (required)
 */
router.post('/terminology/:termId/synonyms', async (req, res) => {
  try {
    const { termId } = req.params;
    const { synonym } = req.body;

    if (!synonym) {
      return res.status(400).json({
        success: false,
        error: 'synonym is required'
      });
    }

    const result = await actionKnowledgeBaseService.addSynonym(termId, synonym);
    res.json(result);
  } catch (error) {
    logger.error('Add synonym error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get all user terminology
 * GET /api/knowledge-base/terminology
 */
router.get('/terminology', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const result = await actionKnowledgeBaseService.getAllFromCollection('userTerminology', limit);
    res.json(result);
  } catch (error) {
    logger.error('Get terminology error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============ Layer 4: Learned Patterns ============

/**
 * Get all learned action patterns
 * GET /api/knowledge-base/learned-patterns
 */
router.get('/learned-patterns', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const result = await actionKnowledgeBaseService.getLearnedPatterns(limit);
    res.json(result);
  } catch (error) {
    logger.error('Get learned patterns error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get learned pattern statistics
 * GET /api/knowledge-base/learned-patterns/stats
 */
router.get('/learned-patterns/stats', async (req, res) => {
  try {
    const stats = await actionKnowledgeBaseService.getLearnedPatternStats();
    res.json({ success: true, stats });
  } catch (error) {
    logger.error('Get learned pattern stats error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Search learned patterns
 * POST /api/knowledge-base/learned-patterns/search
 */
router.post('/learned-patterns/search', async (req, res) => {
  try {
    const { phrase, platform, brand, screen } = req.body;

    if (!phrase) {
      return res.status(400).json({ success: false, error: 'phrase is required' });
    }

    const result = await actionKnowledgeBaseService.findLearnedPattern(
      phrase,
      { platform, brand, screen }
    );

    res.json({ success: true, ...result });
  } catch (error) {
    logger.error('Search learned patterns error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
