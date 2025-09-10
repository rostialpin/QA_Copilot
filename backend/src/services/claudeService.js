import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../utils/logger.js';
import { getConfluenceService } from './confluenceService.js';
import patternLearningService from './patternLearningService.js';

export class ClaudeService {
  constructor() {
    this.apiKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
    this.currentModel = process.env.CLAUDE_MODEL || 'claude-3-opus-20240229';
    
    if (!this.apiKey) {
      logger.warn('Claude/Anthropic AI not configured. Set ANTHROPIC_API_KEY or CLAUDE_API_KEY');
      return;
    }

    this.client = new Anthropic({
      apiKey: this.apiKey,
    });
    
    logger.info(`Claude API configured with model: ${this.currentModel}`);
  }

  getCurrentModel() {
    return this.currentModel;
  }

  async setModel(modelName) {
    const validModels = [
      'claude-3-opus-20240229',
      'claude-3-5-sonnet-20241022',
      'claude-3-haiku-20240307'
    ];
    
    if (!validModels.includes(modelName)) {
      throw new Error(`Invalid model name. Must be one of: ${validModels.join(', ')}`);
    }

    this.currentModel = modelName;
    logger.info(`Model switched to: ${modelName}`);
    return modelName;
  }

  async generateTestCases(ticket, options = {}) {
    // Fetch Confluence documentation if available
    const confluenceService = getConfluenceService();
    const documentation = await confluenceService.fetchTicketDocumentation(ticket);
    
    if (documentation && documentation.scenarios.length > 0) {
      logger.info(`Found ${documentation.scenarios.length} scenarios from Confluence`);
      ticket.confluenceScenarios = documentation.scenarios;
      ticket.technicalSpecs = documentation.technicalSpecs;
    }
    
    // Generate patterns and suggestions from pattern learning service
    const patterns = await patternLearningService.generateWithPatterns(ticket, options);
    if (patterns) {
      logger.info('Using learned patterns for test generation');
      options.patterns = patterns;
      options.selectors = patterns.selectors;
      options.customCommands = patterns.customCommands;
    }
    
    // If repository path is provided, learn from element properties files
    if (options.repositoryPath) {
      const elementPatterns = await this.learnFromElementProperties(options.repositoryPath);
      if (elementPatterns) {
        logger.info('Learned element patterns from properties files');
        options.elementPatterns = elementPatterns;
      }
    }
    
    if (!this.client) {
      logger.warn('Claude API not configured, returning fallback test cases');
      const mockResult = this.generateMockTestCases(ticket, options);
      return mockResult.testCases || [];
    }

    const prompt = this.buildTestCasePrompt(ticket, options);
    logger.info('Generating tests with Claude API for ticket:', ticket.key);
    
    try {
      const message = await this.client.messages.create({
        model: this.currentModel,
        max_tokens: 8000,
        temperature: 0.7,
        system: "You are an expert QA engineer specializing in test automation. Generate comprehensive test cases based on the provided requirements.",
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });
      
      const text = message.content[0].text;
      logger.info('Claude API response received, parsing test cases');
      const parsed = this.parseTestCases(text);
      return parsed.testCases || [];
    } catch (error) {
      logger.error('Claude API error:', error);
      throw error;
    }
  }

  async generateCypressTest(ticket, options = {}) {
    if (!this.client) {
      logger.warn('Claude API not configured');
      return this.generateMockCypressTest(ticket, options);
    }

    const prompt = this.buildCypressPrompt(ticket, options);
    
    try {
      const message = await this.client.messages.create({
        model: this.currentModel,
        max_tokens: 8000,
        temperature: 0.7,
        system: "You are an expert Cypress test automation engineer. Generate production-ready Cypress test code.",
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });
      
      const text = message.content[0].text;
      return this.extractCypressCode(text);
    } catch (error) {
      logger.error('Claude API error:', error);
      throw error;
    }
  }

  async generateSeleniumTest(testData, options = {}) {
    if (!this.client) {
      logger.warn('Claude API not configured');
      return this.generateMockSeleniumTest(testData, options);
    }

    const prompt = this.buildSeleniumPrompt(testData, options);
    
    try {
      const message = await this.client.messages.create({
        model: this.currentModel,
        max_tokens: 8000,
        temperature: 0.7,
        system: "You are an expert Java Selenium test automation engineer. Generate production-ready Selenium WebDriver test code.",
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });
      
      const text = message.content[0].text;
      return this.extractSeleniumCode(text);
    } catch (error) {
      logger.error('Claude API error:', error);
      throw error;
    }
  }

  buildTestCasePrompt(ticket, options = {}) {
    let prompt = `Generate comprehensive test cases for the following ticket:

Title: ${ticket.title || ticket.summary}
Description: ${ticket.description}
`;

    if (ticket.acceptanceCriteria) {
      prompt += `\nAcceptance Criteria:\n${ticket.acceptanceCriteria}`;
    }

    if (ticket.confluenceScenarios) {
      prompt += `\n\nConfluence Test Scenarios:\n`;
      ticket.confluenceScenarios.forEach((scenario, index) => {
        prompt += `\n${index + 1}. ${scenario}`;
      });
    }

    if (options.patterns) {
      prompt += `\n\nUse these learned patterns from the codebase:\n`;
      if (options.patterns.selectors) {
        prompt += `\nCommon Selectors:\n${JSON.stringify(options.patterns.selectors, null, 2)}`;
      }
      if (options.patterns.customCommands) {
        prompt += `\nCustom Commands:\n${JSON.stringify(options.patterns.customCommands, null, 2)}`;
      }
    }

    prompt += `\n\nGenerate test cases in JSON format with the following structure:
{
  "testCases": [
    {
      "name": "Test case name",
      "description": "Test description",
      "preconditions": ["List of preconditions"],
      "steps": [
        {
          "action": "User action",
          "expectedResult": "Expected outcome"
        }
      ],
      "postconditions": ["List of postconditions"],
      "priority": "High|Medium|Low",
      "type": "Functional|UI|Integration|E2E"
    }
  ]
}`;

    return prompt;
  }

  buildCypressPrompt(ticket, options = {}) {
    let prompt = `Generate a comprehensive Cypress test for:

Title: ${ticket.title || ticket.summary}
Description: ${ticket.description}
`;

    if (options.selectors) {
      prompt += `\n\nUse these project-specific selectors:\n${JSON.stringify(options.selectors, null, 2)}`;
    }

    if (options.customCommands) {
      prompt += `\n\nUse these custom Cypress commands:\n${JSON.stringify(options.customCommands, null, 2)}`;
    }

    prompt += `\n\nGenerate production-ready Cypress test code following best practices.`;
    return prompt;
  }

  buildSeleniumPrompt(testData, options = {}) {
    let prompt = `Generate a Java Selenium WebDriver test for:

Test Name: ${testData.name}
Description: ${testData.description}
`;

    if (testData.steps) {
      prompt += `\n\nTest Steps:\n`;
      testData.steps.forEach((step, index) => {
        prompt += `${index + 1}. ${step.action} - Expected: ${step.expectedResult}\n`;
      });
    }

    if (options.elementPatterns) {
      prompt += `\n\nUse these element patterns from properties files:\n${JSON.stringify(options.elementPatterns, null, 2)}`;
    }

    prompt += `\n\nGenerate complete Java Selenium test code with proper waits and error handling.`;
    return prompt;
  }

  parseTestCases(text) {
    try {
      // Try to extract JSON from the response
      const jsonMatch = text.match(/\{[\s\S]*"testCases"[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      // If no JSON found, try to parse the entire text
      return JSON.parse(text);
    } catch (error) {
      logger.error('Failed to parse Claude response as JSON:', error);
      // Return a basic structure if parsing fails
      return {
        testCases: [{
          name: 'Generated Test Case',
          description: 'Test case generated from Claude response',
          steps: [{
            action: 'Review generated content',
            expectedResult: text
          }],
          priority: 'Medium',
          type: 'Functional'
        }]
      };
    }
  }

  extractCypressCode(text) {
    // Extract code blocks from the response
    const codeMatch = text.match(/```(?:javascript|js|typescript|ts)?\n([\s\S]*?)```/);
    if (codeMatch) {
      return codeMatch[1].trim();
    }
    return text;
  }

  extractSeleniumCode(text) {
    // Extract Java code blocks from the response
    const codeMatch = text.match(/```(?:java)?\n([\s\S]*?)```/);
    if (codeMatch) {
      return codeMatch[1].trim();
    }
    return text;
  }

  async learnFromElementProperties(repositoryPath) {
    // This would be implemented to learn from element properties files
    // For now, return null
    return null;
  }

  generateMockTestCases(ticket, options) {
    return {
      testCases: [{
        name: `Test for ${ticket.title || ticket.summary}`,
        description: 'Mock test case (Claude API not configured)',
        preconditions: ['User is logged in'],
        steps: [
          {
            action: 'Navigate to the feature',
            expectedResult: 'Feature page is displayed'
          },
          {
            action: 'Perform the main action',
            expectedResult: 'Action completes successfully'
          }
        ],
        postconditions: ['Data is saved correctly'],
        priority: 'Medium',
        type: 'Functional'
      }]
    };
  }

  generateMockCypressTest(ticket, options) {
    return `describe('${ticket.title || ticket.summary}', () => {
  it('should complete the main flow', () => {
    cy.visit('/');
    // Mock test - Claude API not configured
  });
});`;
  }

  generateMockSeleniumTest(testData, options) {
    return `@Test
public void test${testData.name.replace(/\s+/g, '')}() {
    // Mock test - Claude API not configured
    driver.get(baseUrl);
    // Add test implementation
}`;
  }
}

// Export singleton instance
export const claudeService = new ClaudeService();
export default claudeService;