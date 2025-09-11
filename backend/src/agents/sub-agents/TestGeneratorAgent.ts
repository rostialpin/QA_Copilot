/**
 * Test Generator Agent
 * Specialized agent for generating test cases
 */

import { BaseAgent } from '../base/BaseAgent';
import { AgentRole, AgentProvider, AgentConfig, TestContext, TestResult } from '../types';

export class TestGeneratorAgent extends BaseAgent {
  constructor(provider: AgentProvider, config?: Partial<AgentConfig>) {
    super(AgentRole.TEST_GENERATOR, provider, config);
  }

  async analyze(context: TestContext): Promise<TestResult> {
    try {
      // Generate appropriate test cases based on context
      const tests = await this.generateTests(context);
      
      return this.formatResult({
        generatedTests: tests,
        testsGenerated: this.countTests(tests),
        suggestions: this.generateSuggestions(context)
      });
    } catch (error) {
      throw new Error(`Test generation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async generateTests(context: TestContext): Promise<string> {
    // Build prompt based on context
    const prompt = this.buildPrompt(context);
    
    // This would call the actual AI provider API
    // For now, returning a template
    return this.generateTestTemplate(context);
  }

  private buildPrompt(context: TestContext): string {
    const parts = [
      `Generate ${context.testType} tests for the following context:`,
      context.targetFile ? `File: ${context.targetFile}` : '',
      context.targetFunction ? `Function: ${context.targetFunction}` : '',
      `Framework: ${context.framework}`,
      `Test Type: ${context.testType}`,
      context.coverageGoal ? `Coverage Goal: ${context.coverageGoal}%` : '',
      context.customPrompt || ''
    ];

    return parts.filter(Boolean).join('\n');
  }

  private generateTestTemplate(context: TestContext): string {
    const framework = context.framework;
    const testType = context.testType;

    if (framework === 'jest') {
      return `
describe('${context.targetFunction || 'Component'}', () => {
  beforeEach(() => {
    // Setup
  });

  afterEach(() => {
    // Cleanup
  });

  it('should handle basic functionality', () => {
    // Test implementation
    expect(true).toBe(true);
  });

  it('should handle edge cases', () => {
    // Edge case test
    expect(true).toBe(true);
  });

  it('should handle error conditions', () => {
    // Error handling test
    expect(() => {
      // Code that should throw
    }).toThrow();
  });
});`;
    } else if (framework === 'cypress' && testType === 'e2e') {
      return `
describe('${context.targetFunction || 'E2E Test'}', () => {
  beforeEach(() => {
    cy.visit('/');
  });

  it('should load the page successfully', () => {
    cy.contains('Welcome').should('be.visible');
  });

  it('should interact with elements', () => {
    cy.get('[data-testid="button"]').click();
    cy.get('[data-testid="result"]').should('contain', 'Success');
  });

  it('should handle form submission', () => {
    cy.get('input[name="email"]').type('test@example.com');
    cy.get('form').submit();
    cy.url().should('include', '/success');
  });
});`;
    } else if (framework === 'playwright') {
      return `
import { test, expect } from '@playwright/test';

test.describe('${context.targetFunction || 'Playwright Test'}', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should load the page', async ({ page }) => {
    await expect(page).toHaveTitle(/Home/);
  });

  test('should interact with elements', async ({ page }) => {
    await page.click('[data-testid="button"]');
    await expect(page.locator('[data-testid="result"]')).toContainText('Success');
  });

  test('should handle navigation', async ({ page }) => {
    await page.click('a[href="/about"]');
    await expect(page).toHaveURL(/.*about/);
  });
});`;
    }

    return '// Generated test template';
  }

  private countTests(tests: string): number {
    // Count test cases in the generated code
    const patterns = [
      /\bit\(/g,
      /\btest\(/g,
      /\btest\./g,
      /\bdescribe\(/g
    ];

    let count = 0;
    for (const pattern of patterns) {
      const matches = tests.match(pattern);
      if (matches) {
        count += matches.length;
      }
    }

    return count;
  }

  private generateSuggestions(context: TestContext): string[] {
    const suggestions = [];

    if (!context.coverageGoal || context.coverageGoal < 80) {
      suggestions.push('Consider setting a coverage goal of at least 80%');
    }

    if (context.testType === 'unit' && !context.existingTests?.length) {
      suggestions.push('Start with basic functionality tests before edge cases');
    }

    if (context.framework === 'cypress' && context.testType === 'e2e') {
      suggestions.push('Use data-testid attributes for reliable element selection');
    }

    if (context.testType === 'performance') {
      suggestions.push('Include baseline metrics for comparison');
    }

    return suggestions;
  }
}