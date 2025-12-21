/**
 * Hybrid RAG Service Routes
 *
 * Endpoints for repository indexing and context retrieval
 */

import { Router } from 'express';
import { hybridRAGService } from '../services/hybridRAGService.js';
import { logger } from '../utils/logger.js';

const router = Router();

/**
 * Initialize RAG service (connect to ChromaDB)
 * POST /api/hybrid-rag/initialize
 */
router.post('/initialize', async (req, res) => {
  try {
    const { chromaHost } = req.body;
    const success = await hybridRAGService.initialize(chromaHost);

    res.json({
      success,
      message: success ? 'RAG service initialized' : 'Failed to initialize'
    });
  } catch (error) {
    logger.error('RAG initialization error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Index a repository for RAG retrieval
 * POST /api/hybrid-rag/index
 */
router.post('/index', async (req, res) => {
  try {
    const { repositoryPath } = req.body;

    if (!repositoryPath) {
      return res.status(400).json({
        success: false,
        error: 'repositoryPath is required'
      });
    }

    logger.info(`Starting repository indexing: ${repositoryPath}`);
    const result = await hybridRAGService.indexRepository(repositoryPath);

    res.json(result);
  } catch (error) {
    logger.error('Repository indexing error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Retrieve context using hybrid RAG + user hints
 * POST /api/hybrid-rag/retrieve
 *
 * Body:
 * - testScenario: string (required) - Description of the test
 * - hints: object (optional)
 *   - similarTest: string - Path to a similar test file
 *   - primaryScreen: string - Main screen name (e.g., "player")
 *   - template: string - Quick template name
 * - topK: number (optional) - Results per category (default: 5)
 */
router.post('/retrieve', async (req, res) => {
  try {
    const { testScenario, hints, topK } = req.body;

    if (!testScenario) {
      return res.status(400).json({
        success: false,
        error: 'testScenario is required'
      });
    }

    const context = await hybridRAGService.retrieveContext({
      testScenario,
      hints: hints || {},
      topK: topK || 5
    });

    res.json({
      success: true,
      context,
      summary: {
        pageObjects: context.pageObjects.length,
        properties: context.properties.length,
        tests: context.tests.length,
        methods: context.methods.length,
        confidence: context.confidence
      }
    });
  } catch (error) {
    logger.error('Context retrieval error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get RAG index statistics
 * GET /api/hybrid-rag/stats
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await hybridRAGService.getStats();
    res.json({ success: true, stats });
  } catch (error) {
    logger.error('Stats error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Clear RAG index (for re-indexing)
 * DELETE /api/hybrid-rag/index
 */
router.delete('/index', async (req, res) => {
  try {
    await hybridRAGService.clearIndex();
    res.json({ success: true, message: 'Index cleared' });
  } catch (error) {
    logger.error('Clear index error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
