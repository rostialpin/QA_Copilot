import { geminiService } from './geminiService.js';
import { claudeService } from './claudeService.js';
import { logger } from '../utils/logger.js';

class AIService {
  constructor() {
    this.providers = {
      gemini: geminiService,
      claude: claudeService
    };
    
    // Default to Gemini if configured, otherwise Claude
    this.currentProvider = process.env.DEFAULT_AI_PROVIDER || 'gemini';
    
    // Validate current provider
    if (!this.providers[this.currentProvider]) {
      logger.warn(`Invalid provider ${this.currentProvider}, defaulting to gemini`);
      this.currentProvider = 'gemini';
    }
    
    logger.info(`AI Service initialized with provider: ${this.currentProvider}`);
  }

  getCurrentProvider() {
    return this.currentProvider;
  }

  setProvider(providerName) {
    if (!this.providers[providerName]) {
      throw new Error(`Invalid provider: ${providerName}. Must be one of: ${Object.keys(this.providers).join(', ')}`);
    }
    
    this.currentProvider = providerName;
    logger.info(`AI provider switched to: ${providerName}`);
    return providerName;
  }

  getCurrentModel() {
    return this.providers[this.currentProvider].getCurrentModel();
  }

  async setModel(modelName) {
    return this.providers[this.currentProvider].setModel(modelName);
  }

  getAvailableModels() {
    const models = {
      gemini: ['gemini-2.5-flash', 'gemini-2.5-pro'],
      claude: ['claude-opus-4-1-20250805', 'claude-3-5-sonnet-20241022', 'claude-3-opus-20240229', 'claude-3-haiku-20240307']
    };
    return models[this.currentProvider] || [];
  }

  async generateTestCases(ticket, options = {}) {
    try {
      logger.info(`Generating test cases using ${this.currentProvider}`);
      return await this.providers[this.currentProvider].generateTestCases(ticket, options);
    } catch (error) {
      logger.error(`Error with ${this.currentProvider}, attempting fallback`, error);
      
      // Try fallback provider
      const fallbackProvider = this.currentProvider === 'gemini' ? 'claude' : 'gemini';
      if (this.providers[fallbackProvider]) {
        logger.info(`Attempting fallback to ${fallbackProvider}`);
        return await this.providers[fallbackProvider].generateTestCases(ticket, options);
      }
      
      throw error;
    }
  }

  async generateCypressTest(ticket, options = {}) {
    const provider = this.providers[this.currentProvider];
    
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
    const provider = this.providers[this.currentProvider];
    
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
    
    for (const [providerName, provider] of Object.entries(this.providers)) {
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
    let seleniumCode = `@Test\n`;
    seleniumCode += `public void test${testData.name.replace(/\s+/g, '')}() {\n`;
    seleniumCode += `    // ${testData.description}\n`;
    
    if (testData.steps) {
      testData.steps.forEach(step => {
        seleniumCode += `    // ${step.action}\n`;
        seleniumCode += `    // Expected: ${step.expectedResult}\n`;
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