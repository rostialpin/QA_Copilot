import { geminiService } from './geminiService.js';
import { logger } from '../utils/logger.js';

class AIService {
  constructor() {
    // Initialize providers lazily
    this._providers = null;

    // Default to OpenRouter if configured, otherwise Gemini
    const hasOpenRouter = process.env.OPENROUTER_API_KEYS || process.env.OPENROUTER_API_KEY;
    this.currentProvider = process.env.DEFAULT_AI_PROVIDER || (hasOpenRouter ? 'openrouter' : 'gemini');
    this.defaultModel = this.currentProvider === 'openrouter'
      ? (process.env.OPENROUTER_DEFAULT_MODEL || 'google/gemini-2.5-flash-preview-05-20')
      : 'gemini-2.5-pro';

    logger.info(`AI Service initialized with provider: ${this.currentProvider} (model: ${this.defaultModel})`);
  }

  async getProviders() {
    if (!this._providers) {
      // Lazy load claude and openrouter services
      const { getClaudeService } = await import('./claudeService.js');
      const { getOpenRouterService } = await import('./openrouterService.js');
      this._providers = {
        gemini: geminiService,
        claude: getClaudeService(),
        openrouter: getOpenRouterService()
      };
    }
    return this._providers;
  }
  
  get providers() {
    // For synchronous access, return cached providers or default
    if (!this._providers) {
      return {
        gemini: geminiService,
        claude: null // Will be loaded when needed
      };
    }
    return this._providers;
  }

  getCurrentProvider() {
    return this.currentProvider;
  }

  async setProvider(providerName) {
    const providers = await this.getProviders();
    if (!providers[providerName]) {
      throw new Error(`Invalid provider: ${providerName}. Must be one of: ${Object.keys(providers).join(', ')}`);
    }
    
    this.currentProvider = providerName;
    logger.info(`AI provider switched to: ${providerName}`);
    return providerName;
  }

  async getCurrentModel() {
    const providers = await this.getProviders();
    return providers[this.currentProvider].getCurrentModel();
  }

  async setModel(modelName) {
    const providers = await this.getProviders();
    return providers[this.currentProvider].setModel(modelName);
  }

  getAvailableModels() {
    const models = {
      gemini: ['gemini-2.5-flash', 'gemini-2.5-pro'],
      claude: ['claude-opus-4-1-20250805', 'claude-3-5-sonnet-20241022', 'claude-3-opus-20240229', 'claude-3-haiku-20240307'],
      openrouter: [
        'google/gemini-2.5-flash-preview-05-20',
        'google/gemini-2.0-flash-exp',
        'anthropic/claude-3.5-sonnet',
        'openai/gpt-4o',
        'openai/gpt-4o-mini'
      ]
    };
    return models[this.currentProvider] || [];
  }

  async generateTestCases(ticket, options = {}) {
    const providers = await this.getProviders();

    try {
      logger.info(`Generating test cases using ${this.currentProvider}`);
      const result = await providers[this.currentProvider].generateTestCases(ticket, options);

      // Check if we got valid results
      if (result && Array.isArray(result) && result.length > 0) {
        return result;
      }

      // If null or empty, try fallback
      logger.warn(`${this.currentProvider} returned empty/null results, falling back to gemini mock`);
      return await providers.gemini.generateTestCases(ticket, options);

    } catch (error) {
      logger.error(`Error with ${this.currentProvider}: ${error.message}, attempting fallback to gemini`);

      // Always fallback to Gemini which has mock generation
      if (this.currentProvider !== 'gemini' && providers.gemini) {
        logger.info('Falling back to Gemini mock generation');
        return await providers.gemini.generateTestCases(ticket, options);
      }

      throw error;
    }
  }

  async generateCypressTest(ticket, options = {}) {
    const providers = await this.getProviders();
    const provider = providers[this.currentProvider];
    
    // Check if provider has Cypress generation method
    if (provider.generateCypressTest) {
      return await provider.generateCypressTest(ticket, options);
    }
    
    // Fallback to generic test case generation
    logger.warn(`${this.currentProvider} doesn't have specific Cypress generation, using generic approach`);
    const testCases = await this.generateTestCases(ticket, options);
    return this.convertTestCasesToCypress(testCases);
  }

  async generateSeleniumTest(testData, options = {}) {
    const providers = await this.getProviders();
    const provider = providers[this.currentProvider];
    
    // Check if options contains a custom prompt for context-aware generation
    if (options.contextAware && options.prompt) {
      logger.info('Using context-aware generation with custom prompt');
      
      // Use the provider's generate method with the custom prompt
      if (provider.generate) {
        try {
          const response = await provider.generate(options.prompt);
          return response;
        } catch (error) {
          logger.error('Error in context-aware generation:', error);
          throw error;
        }
      } else if (provider.generateTestCases) {
        // Fallback to generateTestCases with custom prompt
        try {
          const response = await provider.generateTestCases({ description: options.prompt }, {});
          // Extract the generated code from the response
          if (typeof response === 'string') {
            return response;
          }
          if (Array.isArray(response) && response.length > 0) {
            return this.convertTestCasesToSelenium(response[0], options);
          }
          return '// No test generated';
        } catch (error) {
          logger.error('Error in fallback generation:', error);
          throw error;
        }
      }
    }
    
    // Check if provider has Selenium generation method
    if (provider.generateSeleniumTest) {
      return await provider.generateSeleniumTest(testData, options);
    }
    
    // Fallback to generic test case generation
    logger.warn(`${this.currentProvider} doesn't have specific Selenium generation, using generic approach`);
    return this.convertTestCasesToSelenium(testData, options);
  }

  async compareProviders(ticket, options = {}) {
    const results = {};
    const providers = await this.getProviders();
    
    for (const [providerName, provider] of Object.entries(providers)) {
      try {
        logger.info(`Generating with ${providerName}`);
        results[providerName] = await provider.generateTestCases(ticket, options);
      } catch (error) {
        logger.error(`Error with ${providerName}:`, error);
        results[providerName] = { error: error.message };
      }
    }
    
    return results;
  }

  convertTestCasesToCypress(testCases) {
    if (!Array.isArray(testCases) || testCases.length === 0) {
      return '// No test cases generated';
    }
    
    const testCase = testCases[0];
    let cypressCode = `describe('${testCase.name}', () => {\n`;
    cypressCode += `  it('${testCase.description}', () => {\n`;
    
    testCase.steps.forEach(step => {
      cypressCode += `    // ${step.action}\n`;
      cypressCode += `    // Expected: ${step.expectedResult}\n`;
    });
    
    cypressCode += `  });\n});`;
    return cypressCode;
  }

  convertTestCasesToSelenium(testData, options) {
    // Handle undefined or null input
    if (!testData) {
      logger.warn('convertTestCasesToSelenium received null/undefined testData');
      return '// No test data provided';
    }
    
    const testName = (testData.name || testData.title || 'GeneratedTest').replace(/\s+/g, '');
    const description = testData.description || 'Generated test';
    
    let seleniumCode = `@Test\n`;
    seleniumCode += `public void test${testName}() {\n`;
    seleniumCode += `    // ${description}\n`;
    
    if (testData.steps && Array.isArray(testData.steps)) {
      testData.steps.forEach((step, index) => {
        if (typeof step === 'string') {
          seleniumCode += `    // Step ${index + 1}: ${step}\n`;
        } else if (step && typeof step === 'object') {
          seleniumCode += `    // ${step.action || step.description || `Step ${index + 1}`}\n`;
          if (step.expectedResult) {
            seleniumCode += `    // Expected: ${step.expectedResult}\n`;
          }
        }
      });
    }
    
    seleniumCode += `}`;
    return seleniumCode;
  }

  getProviderStatus() {
    const status = {};
    
    for (const [name, provider] of Object.entries(this.providers)) {
      status[name] = {
        available: !!provider,
        currentModel: provider?.getCurrentModel() || 'Not configured',
        isActive: name === this.currentProvider
      };
    }
    
    return status;
  }
}

// Export singleton instance
export const aiService = new AIService();
export default aiService;