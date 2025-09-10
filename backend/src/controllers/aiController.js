import { aiService } from '../services/aiService.js';
import { logger } from '../utils/logger.js';

export const aiController = {
  // Get current provider and model information
  async getStatus(req, res) {
    try {
      const status = {
        currentProvider: aiService.getCurrentProvider(),
        currentModel: aiService.getCurrentModel(),
        availableModels: aiService.getAvailableModels(),
        providers: aiService.getProviderStatus()
      };
      
      res.json(status);
    } catch (error) {
      logger.error('Error getting AI status:', error);
      res.status(500).json({ error: error.message });
    }
  },

  // Switch AI provider
  async setProvider(req, res) {
    try {
      const { provider } = req.body;
      
      if (!provider) {
        return res.status(400).json({ error: 'Provider name is required' });
      }
      
      const result = aiService.setProvider(provider);
      res.json({ 
        success: true, 
        provider: result,
        currentModel: aiService.getCurrentModel()
      });
    } catch (error) {
      logger.error('Error setting provider:', error);
      res.status(400).json({ error: error.message });
    }
  },

  // Switch AI model
  async setModel(req, res) {
    try {
      const { model } = req.body;
      
      if (!model) {
        return res.status(400).json({ error: 'Model name is required' });
      }
      
      const result = await aiService.setModel(model);
      res.json({ 
        success: true, 
        model: result,
        provider: aiService.getCurrentProvider()
      });
    } catch (error) {
      logger.error('Error setting model:', error);
      res.status(400).json({ error: error.message });
    }
  },

  // Generate test cases using current provider
  async generateTestCases(req, res) {
    try {
      const { ticket, options } = req.body;
      
      if (!ticket) {
        return res.status(400).json({ error: 'Ticket data is required' });
      }
      
      const testCases = await aiService.generateTestCases(ticket, options || {});
      res.json({ 
        success: true,
        provider: aiService.getCurrentProvider(),
        model: aiService.getCurrentModel(),
        testCases 
      });
    } catch (error) {
      logger.error('Error generating test cases:', error);
      res.status(500).json({ error: error.message });
    }
  },

  // Compare results from multiple providers
  async compareProviders(req, res) {
    try {
      const { ticket, options } = req.body;
      
      if (!ticket) {
        return res.status(400).json({ error: 'Ticket data is required' });
      }
      
      const results = await aiService.compareProviders(ticket, options || {});
      res.json({ 
        success: true,
        comparison: results 
      });
    } catch (error) {
      logger.error('Error comparing providers:', error);
      res.status(500).json({ error: error.message });
    }
  },

  // Generate Cypress test
  async generateCypressTest(req, res) {
    try {
      const { ticket, options } = req.body;
      
      if (!ticket) {
        return res.status(400).json({ error: 'Ticket data is required' });
      }
      
      const testCode = await aiService.generateCypressTest(ticket, options || {});
      res.json({ 
        success: true,
        provider: aiService.getCurrentProvider(),
        model: aiService.getCurrentModel(),
        testCode 
      });
    } catch (error) {
      logger.error('Error generating Cypress test:', error);
      res.status(500).json({ error: error.message });
    }
  },

  // Generate Selenium test
  async generateSeleniumTest(req, res) {
    try {
      const { testData, options } = req.body;
      
      if (!testData) {
        return res.status(400).json({ error: 'Test data is required' });
      }
      
      const testCode = await aiService.generateSeleniumTest(testData, options || {});
      res.json({ 
        success: true,
        provider: aiService.getCurrentProvider(),
        model: aiService.getCurrentModel(),
        testCode 
      });
    } catch (error) {
      logger.error('Error generating Selenium test:', error);
      res.status(500).json({ error: error.message });
    }
  }
};