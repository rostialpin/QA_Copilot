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
   * Generate Selenium test from manual test (legacy)
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
   * Generate Selenium test using Gemini AI with smart locators
   */
  async generateTestWithGemini(req, res, next) {
    try {
      const { manualTest, repoPath, testDirectory, ticket } = req.body;
      
      if (!manualTest) {
        return res.status(400).json({ 
          error: 'Manual test is required' 
        });
      }

      // Import Gemini service
      const { geminiService } = await import('../services/geminiService.js');
      
      // Learn from element properties if repository path is provided
      let elementPatterns = null;
      if (repoPath) {
        elementPatterns = await geminiService.learnFromElementProperties(repoPath);
        logger.info('Learned element patterns for automation generation');
      }

      // Generate automation code using Gemini with element patterns
      const automationPrompt = await javaSeleniumService.buildAutomationPrompt(
        manualTest, 
        repoPath, 
        testDirectory,
        elementPatterns
      );
      
      const generatedTest = await geminiService.generateAutomationCode(
        automationPrompt,
        { 
          elementPatterns,
          repositoryPath: repoPath,
          testDirectory
        }
      );
      
      res.json({
        success: true,
        test: generatedTest,
        usedGemini: true,
        elementPatternsFound: elementPatterns ? Object.keys(elementPatterns.locators || {}).length : 0
      });
    } catch (error) {
      logger.error('Error generating test with Gemini:', error);
      // Fallback to legacy generation
      return this.generateTest(req, res, next);
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

  /**
   * Generate enhanced test with DOM and properties
   */
  async generateEnhancedTest(req, res, next) {
    try {
      const { manualTest, options } = req.body;
      
      if (!manualTest) {
        return res.status(400).json({ 
          error: 'Manual test data is required' 
        });
      }

      logger.info('Generating enhanced test with options:', {
        hasUrl: !!options?.url,
        hasProperties: !!options?.propertiesPath,
        primaryPage: options?.primaryPage
      });

      const result = await javaSeleniumService.generateEnhancedSeleniumTest(manualTest, options || {});
      
      res.json({
        success: true,
        ...result,
        enhancements: {
          propertiesUsed: !!options?.propertiesPath,
          domAnalyzed: !!options?.url
        }
      });
    } catch (error) {
      logger.error('Error generating enhanced test:', error);
      next(error);
    }
  }

  /**
   * Learn from properties files
   */
  async learnFromProperties(req, res, next) {
    try {
      const { propertiesPath, primaryPage } = req.body;
      
      if (!propertiesPath) {
        return res.status(400).json({ 
          error: 'Properties path is required' 
        });
      }

      const propertiesData = await javaSeleniumService.learnFromProperties(propertiesPath, primaryPage);
      
      if (propertiesData) {
        res.json({
          success: true,
          pages: Object.keys(propertiesData.pages),
          navigationPatterns: propertiesData.navigationMethods.length,
          elementsInPrimaryPage: Object.keys(propertiesData.primaryPageElements).length
        });
      } else {
        res.status(404).json({ error: 'No properties found' });
      }
    } catch (error) {
      logger.error('Error learning from properties:', error);
      next(error);
    }
  }

  /**
   * Test DOM analysis functionality
   */
  async testDomAnalysis(req, res, next) {
    try {
      const { url } = req.body;
      
      if (!url) {
        return res.status(400).json({ error: 'URL is required' });
      }
      
      logger.info(`Testing DOM analysis for URL: ${url}`);
      
      // Dynamic import to avoid initialization issues
      const domAnalyzerModule = await import('../services/domAnalyzerService.js');
      const domAnalyzer = domAnalyzerModule.default;
      
      // Initialize and analyze
      await domAnalyzer.initialize();
      const result = await domAnalyzer.analyzePage(url);
      await domAnalyzer.cleanup();
      
      // Summary of findings
      const summary = {
        url,
        totalElements: result.elements.length,
        buttons: result.elements.filter(e => e.type === 'button').length,
        inputs: result.elements.filter(e => e.type === 'input').length,
        links: result.elements.filter(e => e.type === 'link').length,
        elementsWithTestId: result.elements.filter(e => e.attributes?.['data-testid']).length,
        elementsWithId: result.elements.filter(e => e.attributes?.id).length,
        elementsWithAriaLabel: result.elements.filter(e => e.attributes?.['aria-label']).length,
        sampleElements: result.elements.slice(0, 10).map(el => ({
          type: el.type,
          text: el.text || el.label,
          testId: el.attributes?.['data-testid'],
          id: el.attributes?.id,
          ariaLabel: el.attributes?.['aria-label']
        }))
      };
      
      res.json({
        success: true,
        ...summary
      });
    } catch (error) {
      logger.error('Error testing DOM analysis:', error);
      next(error);
    }
  }
}

// Export singleton instance
const javaSeleniumController = new JavaSeleniumController();
export default javaSeleniumController;