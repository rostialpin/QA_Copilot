import codebaseIndexService from '../services/codebaseIndexService.js';
import { logger } from '../utils/logger.js';

/**
 * Controller for codebase indexing and search operations
 */
export class CodebaseController {
  /**
   * Index a repository
   */
  async indexRepository(req, res, next) {
    try {
      const { repoPath, forceReindex } = req.body;
      
      if (!repoPath) {
        return res.status(400).json({
          error: 'Repository path is required'
        });
      }
      
      logger.info(`Indexing repository: ${repoPath}`);
      
      // Initialize service if needed
      if (!codebaseIndexService.chromaClient) {
        await codebaseIndexService.initialize();
      }
      
      // Index the repository
      const stats = await codebaseIndexService.indexRepository(repoPath, forceReindex);
      
      res.json({
        success: true,
        message: `Repository indexed successfully`,
        stats
      });
    } catch (error) {
      logger.error('Error indexing repository:', error);
      next(error);
    }
  }

  /**
   * Get index status for a repository
   */
  async getIndexStatus(req, res, next) {
    try {
      const { repoPath } = req.query;
      
      if (!repoPath) {
        return res.status(400).json({
          error: 'Repository path is required'
        });
      }
      
      const collection = await codebaseIndexService.getCollection(repoPath);
      
      if (!collection) {
        return res.json({
          indexed: false,
          message: 'Repository not indexed'
        });
      }
      
      const stats = await codebaseIndexService.getIndexStats(collection);
      
      res.json({
        indexed: true,
        stats
      });
    } catch (error) {
      logger.error('Error getting index status:', error);
      next(error);
    }
  }

  /**
   * Find similar tests
   */
  async findSimilarTests(req, res, next) {
    try {
      const { testScenario, repoPath, limit = 5 } = req.body;
      
      if (!testScenario || !repoPath) {
        return res.status(400).json({
          error: 'Test scenario and repository path are required'
        });
      }
      
      logger.info(`Finding similar tests for: ${testScenario.substring(0, 100)}...`);
      
      const similarTests = await codebaseIndexService.findSimilarTests(
        testScenario,
        repoPath,
        limit
      );
      
      res.json({
        success: true,
        tests: similarTests,
        count: similarTests.length
      });
    } catch (error) {
      logger.error('Error finding similar tests:', error);
      next(error);
    }
  }

  /**
   * Find Page Objects
   */
  async findPageObjects(req, res, next) {
    try {
      const { repoPath, searchTerm } = req.query;
      
      if (!repoPath) {
        return res.status(400).json({
          error: 'Repository path is required'
        });
      }
      
      logger.info(`Finding Page Objects in: ${repoPath}`);
      
      const pageObjects = await codebaseIndexService.findPageObjects(
        repoPath,
        searchTerm
      );
      
      res.json({
        success: true,
        pageObjects,
        count: pageObjects.length
      });
    } catch (error) {
      logger.error('Error finding Page Objects:', error);
      next(error);
    }
  }

  /**
   * Search for similar code
   */
  async searchCode(req, res, next) {
    try {
      const { query, repoPath, limit = 10 } = req.body;
      
      if (!query || !repoPath) {
        return res.status(400).json({
          error: 'Query and repository path are required'
        });
      }
      
      logger.info(`Searching for: ${query}`);
      
      const results = await codebaseIndexService.findSimilarCode(
        query,
        repoPath,
        limit
      );
      
      res.json({
        success: true,
        results,
        count: results.length
      });
    } catch (error) {
      logger.error('Error searching code:', error);
      next(error);
    }
  }

  /**
   * Get Page Object methods
   */
  async getPageObjectMethods(req, res, next) {
    try {
      const { repoPath, className } = req.query;
      
      if (!repoPath || !className) {
        return res.status(400).json({
          error: 'Repository path and class name are required'
        });
      }
      
      // Search for the specific Page Object
      const results = await codebaseIndexService.findSimilarCode(
        `class ${className}`,
        repoPath,
        1
      );
      
      if (results.length === 0) {
        return res.status(404).json({
          error: 'Page Object not found'
        });
      }
      
      const pageObject = results[0];
      const methods = JSON.parse(pageObject.metadata.methods || '[]');
      
      res.json({
        success: true,
        className,
        methods,
        filePath: pageObject.filePath
      });
    } catch (error) {
      logger.error('Error getting Page Object methods:', error);
      next(error);
    }
  }

  /**
   * Update index incrementally
   */
  async updateIndex(req, res, next) {
    try {
      const { repoPath } = req.body;
      
      if (!repoPath) {
        return res.status(400).json({
          error: 'Repository path is required'
        });
      }
      
      logger.info(`Updating index for: ${repoPath}`);
      
      // Force incremental update
      const stats = await codebaseIndexService.indexRepository(repoPath, false);
      
      res.json({
        success: true,
        message: 'Index updated successfully',
        stats
      });
    } catch (error) {
      logger.error('Error updating index:', error);
      next(error);
    }
  }
}

// Export singleton instance
const codebaseController = new CodebaseController();
export default codebaseController;