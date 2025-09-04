import javaSeleniumService from '../services/javaSeleniumService.js';
import { logger } from '../utils/logger.js';

export class JavaSeleniumController {
  /**
   * Validate repository path
   */
  async validateRepository(req, res, next) {
    try {
      const { repoPath } = req.body;
      
      if (!repoPath) {
        return res.status(400).json({ 
          error: 'Repository path is required' 
        });
      }

      const result = await javaSeleniumService.validateRepository(repoPath);
      res.json(result);
    } catch (error) {
      logger.error('Error validating repository:', error);
      next(error);
    }
  }

  /**
   * Get directory tree for repository browsing
   */
  async getDirectoryTree(req, res, next) {
    try {
      const { repoPath, relativePath = '' } = req.query;
      
      if (!repoPath) {
        return res.status(400).json({ 
          error: 'Repository path is required' 
        });
      }

      const tree = await javaSeleniumService.getDirectoryTree(repoPath, relativePath);
      res.json(tree);
    } catch (error) {
      logger.error('Error getting directory tree:', error);
      next(error);
    }
  }

  /**
   * Index repository and learn patterns
   */
  async indexRepository(req, res, next) {
    try {
      const { repoPath } = req.body;
      
      if (!repoPath) {
        return res.status(400).json({ 
          error: 'Repository path is required' 
        });
      }

      const index = await javaSeleniumService.indexRepository(repoPath);
      res.json({
        success: true,
        stats: {
          testFiles: index.testFiles.length,
          pageObjects: index.pageObjects.length,
          utilities: index.utilities.length
        }
      });
    } catch (error) {
      logger.error('Error indexing repository:', error);
      next(error);
    }
  }

  /**
   * Learn patterns from selected directory
   */
  async learnPatterns(req, res, next) {
    try {
      const { repoPath, testDirectory, forceReindex } = req.body;
      
      if (!repoPath) {
        return res.status(400).json({ 
          error: 'Repository path is required' 
        });
      }

      const patterns = await javaSeleniumService.learnPatterns(repoPath, testDirectory || '', forceReindex);
      res.json({
        success: true,
        patterns: {
          importsCount: patterns.imports.length,
          annotationsCount: patterns.annotations.length,
          assertionsCount: patterns.assertions.length,
          samples: {
            imports: patterns.imports.slice(0, 5),
            annotations: patterns.annotations.slice(0, 5),
            assertions: patterns.assertions.slice(0, 3)
          }
        }
      });
    } catch (error) {
      logger.error('Error learning patterns:', error);
      next(error);
    }
  }

  /**
   * Generate Selenium test from manual test
   */
  async generateTest(req, res, next) {
    try {
      const { manualTest, repoPath, testDirectory } = req.body;
      
      if (!manualTest || !repoPath) {
        return res.status(400).json({ 
          error: 'Manual test and repository path are required' 
        });
      }

      const generatedTest = await javaSeleniumService.generateSeleniumTest(
        manualTest, 
        repoPath, 
        testDirectory || ''
      );
      
      res.json({
        success: true,
        test: generatedTest
      });
    } catch (error) {
      logger.error('Error generating test:', error);
      next(error);
    }
  }

  /**
   * Save generated test to repository
   */
  async saveTest(req, res, next) {
    try {
      const { repoPath, testDirectory, generatedTest, createBranch, ticketId } = req.body;
      
      if (!repoPath || !generatedTest) {
        return res.status(400).json({ 
          error: 'Repository path and generated test are required' 
        });
      }

      // Create git branch if requested
      let branchResult = null;
      if (createBranch && ticketId) {
        branchResult = await javaSeleniumService.createGitBranch(repoPath, ticketId);
      }

      // Save the test file
      const saveResult = await javaSeleniumService.saveTestToRepository(
        repoPath, 
        testDirectory || '', 
        generatedTest
      );

      res.json({
        success: true,
        ...saveResult,
        branch: branchResult
      });
    } catch (error) {
      logger.error('Error saving test:', error);
      next(error);
    }
  }

  /**
   * Open generated test in IntelliJ
   */
  async openInIDE(req, res, next) {
    try {
      const { filePath } = req.body;
      
      if (!filePath) {
        return res.status(400).json({ 
          error: 'File path is required' 
        });
      }

      const result = await javaSeleniumService.openInIntelliJ(filePath);
      res.json(result);
    } catch (error) {
      logger.error('Error opening in IDE:', error);
      next(error);
    }
  }
}

// Export singleton instance
const javaSeleniumController = new JavaSeleniumController();
export default javaSeleniumController;