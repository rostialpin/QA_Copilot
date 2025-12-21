/**
 * OpenRouter Service for QA-Copilot
 *
 * Provides AI capabilities through OpenRouter with:
 * - Multi-key support with automatic rotation
 * - Rate limit handling
 * - Fallback to mock generation
 *
 * Configuration:
 * - OPENROUTER_API_KEYS: Comma-separated list of API keys
 * - OPENROUTER_DEFAULT_MODEL: Default model (defaults to google/gemini-2.5-flash-preview)
 */

import OpenAI from 'openai';
import { logger } from '../utils/logger.js';

class OpenRouterService {
  constructor() {
    this.apiKeys = this.loadApiKeys();
    this.currentKeyIndex = 0;
    this.failedKeys = new Set();
    this.client = null;
    this.currentModel = process.env.OPENROUTER_DEFAULT_MODEL || 'google/gemini-3-flash-preview';

    if (this.apiKeys.length > 0) {
      this.initializeClient();
      logger.info(`OpenRouter initialized with ${this.apiKeys.length} API key(s), model: ${this.currentModel}`);
    } else {
      logger.warn('OpenRouter not configured - no API keys found');
    }
  }

  /**
   * Load API keys from environment variables
   * Supports: OPENROUTER_API_KEYS (comma-separated) or OPENROUTER_API_KEY (single)
   */
  loadApiKeys() {
    const keysString = process.env.OPENROUTER_API_KEYS || process.env.OPENROUTER_API_KEY || '';

    if (!keysString) {
      return [];
    }

    return keysString
      .split(/[,;\n]/)
      .map(key => key.trim())
      .filter(key => key.length > 0 && key.startsWith('sk-or-'));
  }

  /**
   * Initialize OpenAI client with OpenRouter configuration
   */
  initializeClient() {
    const apiKey = this.getNextAvailableKey();
    if (!apiKey) {
      logger.error('No available OpenRouter API keys');
      return;
    }

    this.client = new OpenAI({
      apiKey,
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': 'https://qa-copilot.local',
        'X-Title': 'QA-Copilot Test Generation'
      }
    });
  }

  /**
   * Get next available API key (skip failed ones)
   */
  getNextAvailableKey() {
    if (this.apiKeys.length === 0) return null;

    const startIndex = this.currentKeyIndex;
    do {
      const key = this.apiKeys[this.currentKeyIndex];
      this.currentKeyIndex = (this.currentKeyIndex + 1) % this.apiKeys.length;

      if (!this.failedKeys.has(key)) {
        return key;
      }
    } while (this.currentKeyIndex !== startIndex);

    // All keys failed - reset and try again
    logger.warn('All OpenRouter keys have failed, resetting...');
    this.failedKeys.clear();
    return this.apiKeys[0];
  }

  /**
   * Mark current key as failed and rotate to next
   */
  markKeyAsFailedAndRotate() {
    if (this.client) {
      const currentKey = this.client.apiKey;
      this.failedKeys.add(currentKey);
      logger.warn(`Marked OpenRouter key as failed (${this.failedKeys.size}/${this.apiKeys.length})`);
    }

    const nextKey = this.getNextAvailableKey();
    if (nextKey) {
      this.client = new OpenAI({
        apiKey: nextKey,
        baseURL: 'https://openrouter.ai/api/v1',
        defaultHeaders: {
          'HTTP-Referer': 'https://qa-copilot.local',
          'X-Title': 'QA-Copilot Test Generation'
        }
      });
      return true;
    }
    return false;
  }

  /**
   * Check if OpenRouter is configured and available
   */
  isConfigured() {
    return this.apiKeys.length > 0 && this.client !== null;
  }

  /**
   * Get current model
   */
  getCurrentModel() {
    return this.currentModel;
  }

  /**
   * Set model to use
   */
  setModel(modelName) {
    this.currentModel = modelName;
    logger.info(`OpenRouter model set to: ${modelName}`);
    return modelName;
  }

  /**
   * Generate test cases using OpenRouter
   */
  async generateTestCases(ticket, options = {}) {
    if (!this.isConfigured()) {
      logger.warn('OpenRouter not configured, returning null for fallback');
      return null;
    }

    const prompt = this.buildTestCasePrompt(ticket, options);

    try {
      const response = await this.chat({
        systemPrompt: 'You are a QA expert that generates comprehensive test cases. Always respond with valid JSON.',
        userPrompt: prompt,
        maxTokens: 4000
      });

      return this.parseTestCases(response.content);
    } catch (error) {
      logger.error('OpenRouter generateTestCases error:', error.message);
      return null;
    }
  }

  /**
   * Build prompt for test case generation
   */
  buildTestCasePrompt(ticket, options = {}) {
    const {
      testCount = 10,
      testTypes = ['functional'],
      includePerformance = false,
      includeSecurity = false,
      includeAccessibility = false
    } = options;

    const typesRequested = [];
    if (testTypes.includes('functional')) typesRequested.push('functional');
    if (includePerformance || testTypes.includes('performance')) typesRequested.push('performance');
    if (includeSecurity || testTypes.includes('security')) typesRequested.push('security');
    if (includeAccessibility || testTypes.includes('accessibility')) typesRequested.push('accessibility');

    return `Generate ${testCount} comprehensive test cases for this ticket.

TICKET DETAILS:
- Key: ${ticket.key}
- Summary: ${ticket.summary}
- Type: ${ticket.type || 'Story'}
- Description: ${ticket.description || 'No description provided'}
${ticket.acceptanceCriteria ? `- Acceptance Criteria: ${ticket.acceptanceCriteria}` : ''}

TEST TYPES REQUESTED: ${typesRequested.join(', ')}

Generate exactly ${testCount} test cases distributed across the requested types.
${typesRequested.includes('functional') ? `Include functional tests for happy path, validation, edge cases.` : ''}
${typesRequested.includes('performance') ? `Include performance tests for response time, load, resource usage.` : ''}
${typesRequested.includes('security') ? `Include security tests for authentication, authorization, input validation.` : ''}
${typesRequested.includes('accessibility') ? `Include accessibility tests for WCAG 2.1 compliance.` : ''}

Respond with a JSON array of test cases in this exact format:
\`\`\`json
[
  {
    "title": "Test title",
    "testType": "functional|performance|security|accessibility",
    "objective": "What this test validates",
    "preconditions": "Setup requirements",
    "priority": "High|Medium|Low",
    "steps": [
      {"action": "Step action", "expectedResult": "Expected outcome"}
    ],
    "expectedResult": "Overall expected result"
  }
]
\`\`\``;
  }

  /**
   * Parse test cases from AI response
   */
  parseTestCases(content) {
    try {
      // Extract JSON from markdown code block if present
      const jsonMatch = content.match(/```json\s*([\s\S]*?)```/);
      const jsonContent = jsonMatch ? jsonMatch[1].trim() : content.trim();

      const parsed = JSON.parse(jsonContent);

      if (Array.isArray(parsed)) {
        return parsed.map(tc => ({
          title: tc.title || tc.Title || 'Test Case',
          testType: tc.testType || tc.test_type || 'functional',
          objective: tc.objective || tc.description || '',
          preconditions: tc.preconditions || '',
          priority: tc.priority || 'Medium',
          steps: Array.isArray(tc.steps) ? tc.steps : [],
          expectedResult: tc.expectedResult || tc.expected_result || ''
        }));
      }

      return parsed.testCases || [];
    } catch (error) {
      logger.error('Failed to parse OpenRouter response:', error.message);
      return null;
    }
  }

  /**
   * Chat completion with automatic key rotation
   */
  async chat({ systemPrompt, userPrompt, temperature = 0.3, maxTokens = 2000 }) {
    if (!this.client) {
      throw new Error('OpenRouter client not initialized');
    }

    const maxRetries = Math.min(3, this.apiKeys.length);
    let lastError;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        logger.info(`OpenRouter API call attempt ${attempt + 1}/${maxRetries} with model ${this.currentModel}`);

        const response = await this.client.chat.completions.create({
          model: this.currentModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature,
          max_tokens: maxTokens
        });

        const usage = response.usage || {};
        logger.info(`OpenRouter response: ${usage.total_tokens || 0} tokens used`);

        return {
          content: response.choices[0]?.message?.content || '',
          model: this.currentModel,
          usage: {
            promptTokens: usage.prompt_tokens || 0,
            completionTokens: usage.completion_tokens || 0,
            totalTokens: usage.total_tokens || 0
          }
        };

      } catch (error) {
        lastError = error;
        const errorMessage = error.message || String(error);
        const errorStatus = error.status || error.response?.status;
        logger.error(`OpenRouter API error (attempt ${attempt + 1}): status=${errorStatus}, message=${errorMessage}`);

        // Handle authentication or rate limit errors
        if (errorStatus === 401 || errorStatus === 429 || errorStatus === 403) {
          if (this.markKeyAsFailedAndRotate()) {
            logger.info('Rotated to next OpenRouter API key');
            continue;
          }
        }

        // For 404 (model not found), try without retrying
        if (errorStatus === 404) {
          logger.error(`Model ${this.currentModel} not found on OpenRouter`);
          break;
        }

        // For other errors, don't retry
        break;
      }
    }

    throw lastError || new Error('OpenRouter API call failed');
  }

  /**
   * Direct content generation
   */
  async generate(prompt) {
    const response = await this.chat({
      systemPrompt: 'You are a helpful AI assistant.',
      userPrompt: prompt
    });
    return response.content;
  }
}

// Singleton instance
let instance = null;

export function getOpenRouterService() {
  if (!instance) {
    instance = new OpenRouterService();
  }
  return instance;
}

export const openrouterService = new OpenRouterService();
export default openrouterService;
