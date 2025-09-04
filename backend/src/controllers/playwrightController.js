import playwrightService from '../services/playwrightService.js';
import { logger } from '../utils/logger.js';

/**
 * Validate Playwright repository
 */
export const validateRepository = async (req, res) => {
  try {
    const { repoPath } = req.body;
    
    if (!repoPath) {
      return res.status(400).json({ 
        valid: false, 
        error: 'Repository path is required' 
      });
    }

    const result = await playwrightService.validateRepository(repoPath);
    res.json(result);
  } catch (error) {
    logger.error('Error validating repository:', error);
    res.status(500).json({ 
      valid: false, 
      error: error.message 
    });
  }
};

/**
 * Get directory tree for UI
 */
export const getDirectoryTree = async (req, res) => {
  try {
    const { repoPath } = req.query;
    
    if (!repoPath) {
      return res.status(400).json({ 
        error: 'Repository path is required' 
      });
    }

    const tree = await playwrightService.getDirectoryTree(repoPath);
    res.json(tree);
  } catch (error) {
    logger.error('Error getting directory tree:', error);
    res.status(500).json({ 
      error: error.message 
    });
  }
};

/**
 * Learn patterns from existing tests
 */
export const learnPatterns = async (req, res) => {
  try {
    const { repoPath, testDirectory } = req.body;
    
    if (!repoPath) {
      return res.status(400).json({ 
        error: 'Repository path is required' 
      });
    }

    const patterns = await playwrightService.learnPatterns(
      repoPath, 
      testDirectory || ''
    );
    
    res.json({ 
      success: true, 
      patterns,
      summary: {
        importsFound: patterns.importsCount || 0,
        selectorsFound: patterns.selectorsCount || 0,
        assertionsFound: patterns.assertionsCount || 0,
        pageObjectsFound: patterns.pageObjects?.length || 0
      }
    });
  } catch (error) {
    logger.error('Error learning patterns:', error);
    res.status(500).json({ 
      error: error.message 
    });
  }
};

/**
 * Generate Playwright test from manual test
 */
export const generateTest = async (req, res) => {
  try {
    const { 
      manualTest, 
      repoPath, 
      testDirectory,
      options = {}
    } = req.body;
    
    if (!manualTest || !repoPath) {
      return res.status(400).json({ 
        error: 'Manual test and repository path are required' 
      });
    }

    // Ensure manual test has the required structure
    const testData = {
      title: manualTest.title || manualTest.name || 'Untitled Test',
      objective: manualTest.objective || manualTest.description || '',
      preconditions: manualTest.preconditions || manualTest.custom_preconds || '',
      steps: []
    };

    // Parse steps based on the format
    if (manualTest.steps && Array.isArray(manualTest.steps)) {
      testData.steps = manualTest.steps;
    } else if (manualTest.custom_steps) {
      // Parse TestRail format steps
      const stepLines = manualTest.custom_steps.split('\n').filter(line => line.trim());
      testData.steps = stepLines.map((line, index) => ({
        action: line.trim(),
        expected: manualTest.custom_expected ? 
          `Step ${index + 1} completes successfully` : ''
      }));
    }

    // Add expected results if available
    if (manualTest.custom_expected && testData.steps.length > 0) {
      const lastStep = testData.steps[testData.steps.length - 1];
      lastStep.expected = manualTest.custom_expected;
    }

    const generatedTest = await playwrightService.generatePlaywrightTest(
      testData,
      repoPath,
      testDirectory || '',
      options
    );

    res.json({ 
      success: true, 
      test: generatedTest
    });
  } catch (error) {
    logger.error('Error generating Playwright test:', error);
    res.status(500).json({ 
      error: error.message 
    });
  }
};

/**
 * Save generated test to repository
 */
export const saveTest = async (req, res) => {
  try {
    const { 
      repoPath, 
      testDirectory, 
      generatedTest,
      createBranch,
      ticketId,
      openInIDE
    } = req.body;
    
    if (!repoPath || !generatedTest) {
      return res.status(400).json({ 
        error: 'Repository path and generated test are required' 
      });
    }

    const saveOptions = {
      createBranch,
      ticketId
    };

    const result = await playwrightService.saveTestToRepository(
      repoPath,
      testDirectory || '',
      generatedTest,
      saveOptions
    );

    // Open in IDE if requested
    if (openInIDE && result.success) {
      await playwrightService.openInVSCode(result.path);
    }

    res.json(result);
  } catch (error) {
    logger.error('Error saving test:', error);
    res.status(500).json({ 
      error: error.message 
    });
  }
};

/**
 * Open file in VS Code
 */
export const openInIDE = async (req, res) => {
  try {
    const { filePath } = req.body;
    
    if (!filePath) {
      return res.status(400).json({ 
        error: 'File path is required' 
      });
    }

    const result = await playwrightService.openInVSCode(filePath);
    res.json(result);
  } catch (error) {
    logger.error('Error opening in IDE:', error);
    res.status(500).json({ 
      error: error.message 
    });
  }
};