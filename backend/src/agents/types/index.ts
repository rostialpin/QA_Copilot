/**
 * QA Copilot Agent Types
 * Core type definitions for the multi-agent system
 */

export enum AgentRole {
  TEST_GENERATOR = 'test_generator',
  TEST_ANALYZER = 'test_analyzer',
  COVERAGE_REPORTER = 'coverage_reporter',
  PERFORMANCE_ANALYZER = 'performance_analyzer',
  SECURITY_SCANNER = 'security_scanner',
  ACCESSIBILITY_CHECKER = 'accessibility_checker',
  API_TESTER = 'api_tester',
  UI_TESTER = 'ui_tester',
  INTEGRATION_TESTER = 'integration_tester',
  ORCHESTRATOR = 'orchestrator'
}

export enum AgentProvider {
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
  GEMINI = 'gemini',
  DEEPSEEK = 'deepseek',
  LOCAL = 'local'
}

export enum ProviderGroup {
  OPENAI = 'openai_group',
  CLAUDE = 'claude_group',
  GEMINI = 'gemini_group',
  DEEPSEEK = 'deepseek_group',
  LOCAL = 'local_group'
}

export interface AgentConfig {
  role: AgentRole;
  provider: AgentProvider;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
  retryAttempts?: number;
  debug?: boolean;
}

export interface TestContext {
  targetFile?: string;
  targetFunction?: string;
  framework: 'jest' | 'cypress' | 'playwright' | 'mocha' | 'jasmine';
  testType: 'unit' | 'integration' | 'e2e' | 'performance' | 'security';
  existingTests?: string[];
  coverageGoal?: number;
  customPrompt?: string;
}

export interface TestResult {
  success: boolean;
  generatedTests?: string;
  coverage?: number;
  issues?: TestIssue[];
  suggestions?: string[];
  metrics?: TestMetrics;
  error?: string;
}

export interface TestIssue {
  severity: 'low' | 'medium' | 'high' | 'critical';
  type: string;
  message: string;
  file?: string;
  line?: number;
  suggestion?: string;
}

export interface TestMetrics {
  executionTime: number;
  testsGenerated?: number;
  testsPassed?: number;
  testsFailed?: number;
  coverage?: {
    statements: number;
    branches: number;
    functions: number;
    lines: number;
  };
  performance?: {
    avgResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
  };
}

export interface MultiAgentConfig {
  name: string;
  strategy: AnalysisStrategy;
  agents: AgentConfig[];
  fallbackEnabled?: boolean;
  fallbackAgents?: AgentConfig[];
  combineResults?: boolean;
  timeout?: number;
}

export enum AnalysisStrategy {
  SEQUENTIAL = 'sequential',
  PARALLEL = 'parallel',
  HIERARCHICAL = 'hierarchical',
  CONSENSUS = 'consensus'
}

export interface AgentResponse<T = any> {
  agentId: string;
  role: AgentRole;
  provider: AgentProvider;
  result: T;
  executionTime: number;
  tokenUsage?: {
    input: number;
    output: number;
    total: number;
  };
  error?: string;
}