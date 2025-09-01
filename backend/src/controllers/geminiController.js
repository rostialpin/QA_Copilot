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

  async getCurrentModel(req, res, next) {
    try {
      const model = this.geminiService.getCurrentModel();
      res.json({ model });
    } catch (error) {
      logger.error('Error getting current model:', error);
      next(error);
    }
  }

  async setModel(req, res, next) {
    try {
      const { model } = req.body;
      
      if (!model || !['gemini-2.5-flash', 'gemini-2.5-pro'].includes(model)) {
        return res.status(400).json({ 
          error: 'Invalid model. Must be either gemini-2.5-flash or gemini-2.5-pro' 
        });
      }

      await this.geminiService.setModel(model);
      res.json({ 
        success: true, 
        model,
        message: `Successfully switched to ${model}` 
      });
    } catch (error) {
      logger.error('Error setting model:', error);
      next(error);
    }
  }
}
