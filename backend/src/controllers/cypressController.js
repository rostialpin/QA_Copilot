import { CypressGenerator } from '../services/cypressGenerator.js';
import { GitHubService } from '../services/githubService.js';
import { logger } from '../utils/logger.js';

export class CypressController {
  constructor() {
    this.cypressGenerator = new CypressGenerator();
    this.githubService = new GitHubService();
  }

  async generateCypressTest(req, res, next) {
    try {
      // Handle both formats: { testCase, options } and direct test case
      const testCase = req.body.testCase || req.body;
      const options = req.body.options || {};
      
      const cypressTest = await this.cypressGenerator.generateTest(testCase, options);
      res.json(cypressTest);
    } catch (error) {
      logger.error('Error generating Cypress test:', error);
      next(error);
    }
  }

  async getTemplates(req, res, next) {
    try {
      const templates = await this.cypressGenerator.getTemplates();
      res.json(templates);
    } catch (error) {
      logger.error('Error fetching templates:', error);
      next(error);
    }
  }

  async analyzeExistingTests(req, res, next) {
    try {
      const { repoPath } = req.body;
      const analysis = await this.githubService.analyzeTestStructure(repoPath);
      res.json(analysis);
    } catch (error) {
      logger.error('Error analyzing existing tests:', error);
      next(error);
    }
  }
}
