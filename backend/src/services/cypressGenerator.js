import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from '../utils/logger.js';
import fs from 'fs/promises';
import path from 'path';

export class CypressGenerator {
  constructor() {
    const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      logger.warn('Gemini API key not configured - will use mock generation');
      return;
    }
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
  }

  async generateTest(testCase, options = {}) {
    if (!this.model) {
      logger.warn('Using mock Cypress test generation');
      return this.generateMockCypressTest(testCase, options);
    }

    const prompt = this.buildCypressPrompt(testCase, options);
    
    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      return this.parseCypressTest(text);
    } catch (error) {
      logger.error('Cypress generation error:', error);
      throw error;
    }
  }

  buildCypressPrompt(testCase, options) {
    const { 
      baseUrl = 'http://localhost:3000',
      selectorStrategy = 'multiple',
      pageObject = false 
    } = options;

    return `Generate a Cypress test for the following test case:
    
Test Case:
${JSON.stringify(testCase, null, 2)}

Requirements:
1. Base URL: ${baseUrl}
2. Use ${selectorStrategy} selector strategies (data-testid, CSS, text)
3. ${pageObject ? 'Use Page Object pattern' : 'Use direct commands'}
4. Include proper assertions
5. Add error handling
6. Generate self-healing selectors with fallbacks
7. Include test data generation where needed

Format the output as a complete Cypress test file with:
- Proper describe/it blocks
- Before/beforeEach hooks if needed
- Comments explaining complex logic
- Multiple selector strategies for each element

Return the code in a JSON object with:
- code: the complete test code
- selectors: array of selectors used
- dependencies: any required imports`;
  }

  parseCypressTest(text) {
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      return {
        code: text,
        selectors: [],
        dependencies: []
      };
    } catch (error) {
      logger.error('Failed to parse Cypress test:', error);
      return {
        code: text,
        selectors: [],
        dependencies: []
      };
    }
  }

  generateMockCypressTest(testCase, options = {}) {
    const { title = 'Test', steps = [], expectedResult = '', preconditions = '', ticketKey = '', testRailId = '' } = testCase;
    
    // Generate a mock Cypress test based on the test case
    const testRailComment = testRailId ? `// TestRail Test Case: #${testRailId}\n` : '';
    const jiraComment = ticketKey ? `// JIRA Ticket: ${ticketKey}\n` : '';
    
    const code = `${testRailComment}${jiraComment}describe('${title}', () => {
  beforeEach(() => {
    // Setup - ${preconditions || 'Navigate to application'}
    cy.visit('/');
    cy.viewport(1280, 720);
  });

  it('should ${title.toLowerCase()}', () => {
    ${steps && steps.length > 0 
      ? steps.map((step, index) => `
    // Step ${index + 1}: ${step.action}
    // Expected: ${step.expected || 'Success'}
    cy.get('[data-testid="element-${index + 1}"]').should('be.visible');
    ${step.action.toLowerCase().includes('click') ? `cy.get('[data-testid="button-${index + 1}"]').click();` : ''}
    ${step.action.toLowerCase().includes('type') || step.action.toLowerCase().includes('enter') ? `cy.get('[data-testid="input-${index + 1}"]').type('test data');` : ''}
    ${step.expected ? `cy.contains('${step.expected}').should('be.visible');` : ''}`).join('\n')
      : `
    // Perform test actions
    cy.get('[data-testid="main-element"]').should('be.visible');
    cy.get('[data-testid="action-button"]').click();
    
    // Verify expected result
    cy.contains('Success').should('be.visible');`}
    
    // Final assertion - ${expectedResult || 'Verify success'}
    cy.get('[data-testid="result"]').should('exist');
    ${expectedResult ? `cy.contains('${expectedResult}').should('be.visible');` : ''}
  });

  afterEach(() => {
    // Cleanup if needed
    cy.clearCookies();
  });
});`;

    return {
      code,
      selectors: ['[data-testid="element"]', '[data-testid="button"]', '[data-testid="input"]'],
      dependencies: []
    };
  }

  async getTemplates() {
    const templatesDir = path.join(process.cwd(), 'cypress-templates');
    try {
      const files = await fs.readdir(templatesDir);
      const templates = [];
      
      for (const file of files) {
        if (file.endsWith('.js') || file.endsWith('.cy.js')) {
          const content = await fs.readFile(path.join(templatesDir, file), 'utf-8');
          templates.push({
            id: file.replace('.cy.js', '').replace('.js', ''),
            name: file,
            description: `Template from ${file}`,
            content: content
          });
        }
      }
      
      return templates;
    } catch (error) {
      logger.warn('No templates directory found, returning mock templates');
      // Return mock templates when directory doesn't exist
      return [
        {
          id: 'login',
          name: 'login-template.cy.js',
          description: 'Login flow template with authentication',
          content: '// Login template'
        },
        {
          id: 'e2e',
          name: 'e2e-template.cy.js', 
          description: 'End-to-end test template',
          content: '// E2E template'
        }
      ];
    }
  }
}
