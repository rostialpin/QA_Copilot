/**
 * Base Agent Class
 * Abstract base class for all QA Copilot agents
 */

import { AgentRole, AgentProvider, AgentConfig, TestContext, TestResult, AgentResponse } from '../types';

export abstract class BaseAgent {
  protected role: AgentRole;
  protected provider: AgentProvider;
  protected config: AgentConfig;
  protected agentId: string;

  constructor(role: AgentRole, provider: AgentProvider, config?: Partial<AgentConfig>) {
    this.role = role;
    this.provider = provider;
    this.config = {
      role,
      provider,
      temperature: 0.7,
      maxTokens: 4000,
      timeout: 30000,
      retryAttempts: 3,
      debug: false,
      ...config
    };
    this.agentId = `${role}-${provider}-${Date.now()}`;
  }

  /**
   * Main analysis method that all agents must implement
   */
  abstract analyze(context: TestContext): Promise<TestResult>;

  /**
   * Execute the agent's analysis with error handling and metrics
   */
  async execute(context: TestContext): Promise<AgentResponse<TestResult>> {
    const startTime = Date.now();
    
    try {
      if (this.config.debug) {
        console.log(`[${this.agentId}] Starting analysis...`, { context });
      }

      const result = await this.withTimeout(
        this.analyze(context),
        this.config.timeout!
      );

      const executionTime = Date.now() - startTime;

      if (this.config.debug) {
        console.log(`[${this.agentId}] Analysis completed in ${executionTime}ms`);
      }

      return {
        agentId: this.agentId,
        role: this.role,
        provider: this.provider,
        result,
        executionTime
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      console.error(`[${this.agentId}] Analysis failed:`, errorMessage);

      return {
        agentId: this.agentId,
        role: this.role,
        provider: this.provider,
        result: {
          success: false,
          error: errorMessage
        },
        executionTime,
        error: errorMessage
      };
    }
  }

  /**
   * Helper method to add timeout to promises
   */
  protected async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs)
      )
    ]);
  }

  /**
   * Helper method for retrying operations
   */
  protected async withRetry<T>(
    operation: () => Promise<T>,
    maxAttempts: number = this.config.retryAttempts!
  ): Promise<T> {
    let lastError: Error | undefined;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt < maxAttempts) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          if (this.config.debug) {
            console.log(`[${this.agentId}] Attempt ${attempt} failed, retrying in ${delay}ms...`);
          }
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError || new Error('Operation failed after retries');
  }

  /**
   * Format and validate the agent's response
   */
  protected formatResult(data: any): TestResult {
    return {
      success: true,
      ...data
    };
  }

  /**
   * Get agent metadata
   */
  getMetadata() {
    return {
      agentId: this.agentId,
      role: this.role,
      provider: this.provider,
      config: this.config
    };
  }
}