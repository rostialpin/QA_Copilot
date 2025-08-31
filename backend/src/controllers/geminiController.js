import { GeminiService } from '../services/geminiService.js';
import { logger } from '../utils/logger.js';

export class GeminiController {
  constructor() {
    this.geminiService = new GeminiService();
  }

  async generateTestCases(req, res, next) {
    try {
      const { ticket, options } = req.body;
      const testCases = await this.geminiService.generateTestCases(ticket, options);
      res.json(testCases);
    } catch (error) {
      logger.error('Error generating test cases:', error);
      next(error);
    }
  }

  async analyzeDuplicate(req, res, next) {
    try {
      const { testCase, existingTestCases } = req.body;
      const analysis = await this.geminiService.analyzeDuplicate(testCase, existingTestCases);
      res.json(analysis);
    } catch (error) {
      logger.error('Error analyzing duplicates:', error);
      next(error);
    }
  }
}
