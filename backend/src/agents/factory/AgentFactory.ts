/**
 * Agent Factory
 * Factory class for creating QA Copilot agents
 */

import { AgentRole, AgentProvider, AgentConfig, ProviderGroup } from '../types';
import { BaseAgent } from '../base/BaseAgent';
import { TestGeneratorAgent } from '../sub-agents/TestGeneratorAgent';
import { TestAnalyzerAgent } from '../sub-agents/TestAnalyzerAgent';
import { CoverageReporterAgent } from '../sub-agents/CoverageReporterAgent';
import { PerformanceAnalyzerAgent } from '../sub-agents/PerformanceAnalyzerAgent';
import { SecurityScannerAgent } from '../sub-agents/SecurityScannerAgent';
import { AccessibilityCheckerAgent } from '../sub-agents/AccessibilityCheckerAgent';
import { ApiTesterAgent } from '../sub-agents/ApiTesterAgent';
import { UiTesterAgent } from '../sub-agents/UiTesterAgent';
import { IntegrationTesterAgent } from '../sub-agents/IntegrationTesterAgent';
import { OrchestratorAgent } from '../sub-agents/OrchestratorAgent';

export class AgentFactory {
  private static providerGroupMapping: Record<ProviderGroup, AgentProvider> = {
    [ProviderGroup.OPENAI]: AgentProvider.OPENAI,
    [ProviderGroup.CLAUDE]: AgentProvider.ANTHROPIC,
    [ProviderGroup.GEMINI]: AgentProvider.GEMINI,
    [ProviderGroup.DEEPSEEK]: AgentProvider.DEEPSEEK,
    [ProviderGroup.LOCAL]: AgentProvider.LOCAL
  };

  /**
   * Create an agent instance based on role and provider
   */
  static createAgent(
    role: AgentRole,
    providerOrGroup: AgentProvider | ProviderGroup,
    config?: Partial<AgentConfig>
  ): BaseAgent {
    // Convert provider group to specific provider if needed
    const provider = this.resolveProvider(providerOrGroup);
    
    // Merge configuration with defaults
    const agentConfig: AgentConfig = {
      role,
      provider,
      ...config
    };

    // Create the appropriate agent based on role
    switch (role) {
      case AgentRole.TEST_GENERATOR:
        return new TestGeneratorAgent(provider, agentConfig);
      
      case AgentRole.TEST_ANALYZER:
        return new TestAnalyzerAgent(provider, agentConfig);
      
      case AgentRole.COVERAGE_REPORTER:
        return new CoverageReporterAgent(provider, agentConfig);
      
      case AgentRole.PERFORMANCE_ANALYZER:
        return new PerformanceAnalyzerAgent(provider, agentConfig);
      
      case AgentRole.SECURITY_SCANNER:
        return new SecurityScannerAgent(provider, agentConfig);
      
      case AgentRole.ACCESSIBILITY_CHECKER:
        return new AccessibilityCheckerAgent(provider, agentConfig);
      
      case AgentRole.API_TESTER:
        return new ApiTesterAgent(provider, agentConfig);
      
      case AgentRole.UI_TESTER:
        return new UiTesterAgent(provider, agentConfig);
      
      case AgentRole.INTEGRATION_TESTER:
        return new IntegrationTesterAgent(provider, agentConfig);
      
      case AgentRole.ORCHESTRATOR:
        return new OrchestratorAgent(provider, agentConfig);
      
      default:
        throw new Error(`Unknown agent role: ${role}`);
    }
  }

  /**
   * Create multiple agents for a multi-agent workflow
   */
  static createMultipleAgents(
    configs: AgentConfig[]
  ): Map<string, BaseAgent> {
    const agents = new Map<string, BaseAgent>();
    
    configs.forEach((config, index) => {
      const agent = this.createAgent(config.role, config.provider, config);
      const key = config.role || `agent-${index}`;
      agents.set(key, agent);
    });
    
    return agents;
  }

  /**
   * Create a standard test suite configuration
   */
  static createTestSuite(provider: AgentProvider | ProviderGroup): Map<string, BaseAgent> {
    const resolvedProvider = this.resolveProvider(provider);
    
    return this.createMultipleAgents([
      { role: AgentRole.TEST_GENERATOR, provider: resolvedProvider },
      { role: AgentRole.TEST_ANALYZER, provider: resolvedProvider },
      { role: AgentRole.COVERAGE_REPORTER, provider: resolvedProvider }
    ]);
  }

  /**
   * Create a comprehensive testing configuration
   */
  static createComprehensiveSuite(provider: AgentProvider | ProviderGroup): Map<string, BaseAgent> {
    const resolvedProvider = this.resolveProvider(provider);
    
    return this.createMultipleAgents([
      { role: AgentRole.TEST_GENERATOR, provider: resolvedProvider },
      { role: AgentRole.TEST_ANALYZER, provider: resolvedProvider },
      { role: AgentRole.COVERAGE_REPORTER, provider: resolvedProvider },
      { role: AgentRole.PERFORMANCE_ANALYZER, provider: resolvedProvider },
      { role: AgentRole.SECURITY_SCANNER, provider: resolvedProvider },
      { role: AgentRole.ACCESSIBILITY_CHECKER, provider: resolvedProvider },
      { role: AgentRole.API_TESTER, provider: resolvedProvider },
      { role: AgentRole.UI_TESTER, provider: resolvedProvider },
      { role: AgentRole.INTEGRATION_TESTER, provider: resolvedProvider }
    ]);
  }

  /**
   * Resolve provider group to specific provider
   */
  private static resolveProvider(providerOrGroup: AgentProvider | ProviderGroup): AgentProvider {
    if (Object.values(AgentProvider).includes(providerOrGroup as AgentProvider)) {
      return providerOrGroup as AgentProvider;
    }
    
    const provider = this.providerGroupMapping[providerOrGroup as ProviderGroup];
    if (!provider) {
      throw new Error(`Unknown provider or group: ${providerOrGroup}`);
    }
    
    return provider;
  }

  /**
   * Get recommended provider for a specific role
   */
  static getRecommendedProvider(role: AgentRole): AgentProvider {
    // Recommendations based on provider strengths
    const recommendations: Record<AgentRole, AgentProvider> = {
      [AgentRole.TEST_GENERATOR]: AgentProvider.OPENAI,
      [AgentRole.TEST_ANALYZER]: AgentProvider.ANTHROPIC,
      [AgentRole.COVERAGE_REPORTER]: AgentProvider.GEMINI,
      [AgentRole.PERFORMANCE_ANALYZER]: AgentProvider.DEEPSEEK,
      [AgentRole.SECURITY_SCANNER]: AgentProvider.ANTHROPIC,
      [AgentRole.ACCESSIBILITY_CHECKER]: AgentProvider.OPENAI,
      [AgentRole.API_TESTER]: AgentProvider.GEMINI,
      [AgentRole.UI_TESTER]: AgentProvider.OPENAI,
      [AgentRole.INTEGRATION_TESTER]: AgentProvider.ANTHROPIC,
      [AgentRole.ORCHESTRATOR]: AgentProvider.ANTHROPIC
    };
    
    return recommendations[role] || AgentProvider.OPENAI;
  }
}