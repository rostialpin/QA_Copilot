import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from '../utils/logger.js';

export class GeminiService {
  constructor() {
    // Support both direct API key and Google Application Credentials
    const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    
    if (!apiKey && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      logger.warn('Gemini/Google AI not configured. Set either GOOGLE_API_KEY or GOOGLE_APPLICATION_CREDENTIALS');
      return;
    }

    if (apiKey) {
      // Use direct API key for Gemini
      this.genAI = new GoogleGenerativeAI(apiKey);
      
      // Use Gemini 2.5 Flash by default (faster, good quality) or Pro for higher quality
      // You can switch between 'gemini-2.5-flash' and 'gemini-2.5-pro' based on needs
      const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
      this.model = this.genAI.getGenerativeModel({ model: modelName });
      logger.info(`Gemini API configured with model: ${modelName}`);
    } else {
      // For Vertex AI, you would need different initialization
      logger.info(`Google AI configured with service account: ${process.env.GOOGLE_APPLICATION_CREDENTIALS}`);
      // Note: For Vertex AI, you'd need to use @google-cloud/aiplatform instead
    }
  }

  async generateTestCases(ticket, options = {}) {
    if (!this.model) {
      logger.warn('Gemini API not configured, returning mock test cases');
      return this.generateMockTestCases(ticket, options);
    }

    const prompt = this.buildTestCasePrompt(ticket, options);
    
    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      return this.parseTestCases(text);
    } catch (error) {
      logger.error('Gemini API error:', error);
      throw error;
    }
  }

  generateMockTestCases(ticket, options = {}) {
    const { style = 'BDD' } = options;
    const mockTestCases = [
      {
        title: `Verify ${ticket.summary} - Happy Path`,
        objective: `Validate that the main functionality of ${ticket.summary} works as expected`,
        preconditions: 'User is logged in and has necessary permissions',
        priority: 'High',
        steps: [
          { action: 'Navigate to the relevant page', expected: 'Page loads successfully' },
          { action: 'Perform the main action', expected: 'Action completes without errors' },
          { action: 'Verify the result', expected: 'Expected outcome is achieved' }
        ],
        expectedResult: 'Feature works as described in requirements'
      },
      {
        title: `Verify ${ticket.summary} - Error Handling`,
        objective: `Ensure proper error handling for ${ticket.summary}`,
        preconditions: 'System is in a state where errors can be triggered',
        priority: 'Medium',
        steps: [
          { action: 'Navigate to the relevant page', expected: 'Page loads successfully' },
          { action: 'Trigger an error condition', expected: 'Error is handled gracefully' },
          { action: 'Check error message', expected: 'Appropriate error message is displayed' }
        ],
        expectedResult: 'System handles errors gracefully with proper user feedback'
      },
      {
        title: `Verify ${ticket.summary} - Edge Cases`,
        objective: `Test edge cases and boundary conditions for ${ticket.summary}`,
        preconditions: 'Test data prepared for edge cases',
        priority: 'Low',
        steps: [
          { action: 'Test with minimum valid input', expected: 'System accepts input' },
          { action: 'Test with maximum valid input', expected: 'System handles correctly' },
          { action: 'Test with boundary values', expected: 'Proper validation occurs' }
        ],
        expectedResult: 'All edge cases are handled appropriately'
      }
    ];

    return { testCases: mockTestCases, style };
  }

  buildTestCasePrompt(ticket, options) {
    const { style = 'BDD', types = ['positive', 'negative', 'edge'] } = options;
    
    return `Generate comprehensive test cases for the following JIRA ticket:
    
Title: ${ticket.summary}
Description: ${ticket.description || 'No description provided'}
Type: ${ticket.type}
Acceptance Criteria: ${ticket.acceptanceCriteria || 'Not specified'}

Requirements:
1. Generate test cases in ${style} format
2. Include ${types.join(', ')} test scenarios
3. Each test case should have:
   - Title
   - Description
   - Preconditions
   - Steps (or Given/When/Then for BDD)
   - Expected Result
   - Test Data (if applicable)
4. Format the output as JSON array

Generate realistic and comprehensive test cases that would catch real bugs.`;
  }

  parseTestCases(text) {
    try {
      // First try to find JSON array in the text
      const jsonMatch = text.match(/```json\s*([\s\S]*?)```/);
      if (jsonMatch) {
        const jsonContent = jsonMatch[1];
        const parsed = JSON.parse(jsonContent);
        
        // Convert the format to match what frontend expects
        if (Array.isArray(parsed)) {
          return {
            testCases: parsed.map(tc => ({
              title: tc.Title || tc.title,
              objective: tc.Description || tc.description,
              preconditions: Array.isArray(tc.Preconditions) 
                ? tc.Preconditions.join('; ') 
                : tc.Preconditions || tc.preconditions || '',
              steps: this.convertStepsFormat(tc.Steps || tc.steps),
              expectedResult: tc['Expected Result'] || tc.expectedResult || tc.expected_result || '',
              priority: tc.Priority || tc.priority || 'Medium',
              testData: tc['Test Data'] || tc.testData || tc.test_data
            }))
          };
        }
      }
      
      // Try direct JSON parse
      const parsed = JSON.parse(text);
      if (parsed.testCases) {
        return parsed;
      }
      if (Array.isArray(parsed)) {
        return { testCases: parsed };
      }
      
      return { testCases: [parsed] };
    } catch (error) {
      logger.error('Failed to parse Gemini response, using fallback:', error.message);
      // Fallback to simple format
      return {
        testCases: [{
          title: 'Generated Test Case',
          objective: 'AI-generated test case',
          preconditions: 'System is accessible',
          steps: [
            { action: 'Perform test action', expected: 'Expected outcome' }
          ],
          expectedResult: 'Test passes successfully',
          priority: 'Medium'
        }]
      };
    }
  }

  convertStepsFormat(steps) {
    if (!steps) return [];
    
    // If steps is already in the right format
    if (Array.isArray(steps) && steps.length > 0 && typeof steps[0] === 'object' && 'action' in steps[0]) {
      return steps;
    }
    
    // If steps is an array of strings (BDD format)
    if (Array.isArray(steps)) {
      return steps.map((step, index) => {
        // Try to parse Given/When/Then format
        const match = step.match(/^(Given|When|Then|And)\s+(.+)/i);
        if (match) {
          const [, keyword, content] = match;
          if (keyword.toLowerCase() === 'then' || keyword.toLowerCase() === 'and' && index > 0 && steps[index-1].toLowerCase().includes('then')) {
            return { action: 'Verify', expected: content };
          }
          return { action: content, expected: '' };
        }
        // Default format
        return { action: step, expected: '' };
      });
    }
    
    // If steps is a single string
    if (typeof steps === 'string') {
      return steps.split('\n').filter(s => s.trim()).map(step => ({
        action: step,
        expected: ''
      }));
    }
    
    return [];
  }

  async analyzeDuplicate(testCase, existingTestCases) {
    if (!this.model) {
      throw new Error('Gemini API not configured');
    }

    const prompt = `Analyze if this test case is a duplicate of any existing test cases.
    
New Test Case:
${JSON.stringify(testCase, null, 2)}

Existing Test Cases:
${JSON.stringify(existingTestCases, null, 2)}

Return a JSON object with:
- isDuplicate: boolean
- similarityScore: number (0-100)
- similarTestCases: array of IDs of similar test cases
- recommendation: string`;

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      return JSON.parse(text);
    } catch (error) {
      logger.error('Duplicate analysis error:', error);
      return {
        isDuplicate: false,
        similarityScore: 0,
        similarTestCases: [],
        recommendation: 'Unable to analyze'
      };
    }
  }
}
