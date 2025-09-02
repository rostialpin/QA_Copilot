import { logger } from '../utils/logger.js';
import { filterJiraTicket } from '../config/fieldFilter.config.js';
import { JiraService } from './jiraService.js';
import { TestRailService } from './testRailService.js';
import { GeminiService } from './geminiService.js';
import { CypressGenerator } from './cypressGenerator.js';
import patternLearningService from './patternLearningService.js';

/**
 * Workflow Orchestrator Service
 * Manages the complete flow from JIRA ticket to TestRail test cases
 */
export class WorkflowOrchestrator {
  constructor() {
    this.workflows = new Map(); // Store active workflows
    this.jiraService = new JiraService();
    this.testRailService = new TestRailService();
    this.geminiService = new GeminiService();
    this.cypressGenerator = new CypressGenerator();
  }

  /**
   * Start a new workflow
   */
  async startWorkflow(userId) {
    const workflowId = `workflow_${Date.now()}_${userId}`;
    
    const workflow = {
      id: workflowId,
      userId,
      status: 'started',
      currentStep: 1,
      steps: {
        1: { name: 'selectTicket', status: 'pending', data: null },
        2: { name: 'selectContext', status: 'pending', data: null },
        3: { name: 'generateTests', status: 'pending', data: null },
        4: { name: 'reviewTests', status: 'pending', data: null },
        5: { name: 'saveToTestRail', status: 'pending', data: null },
        6: { name: 'generateCypress', status: 'optional', data: null }
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    this.workflows.set(workflowId, workflow);
    logger.info(`Started workflow ${workflowId} for user ${userId}`);
    
    return {
      workflowId,
      workflow
    };
  }

  /**
   * Execute Step 1: Select and process JIRA ticket
   */
  async selectTicket(workflowId, ticketData) {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) throw new Error('Workflow not found');
    
    try {
      logger.info(`Step 1: Selecting ticket ${ticketData.key} for workflow ${workflowId}`);
      
      // Fetch full ticket details if needed
      let fullTicket = ticketData;
      if (!ticketData.description) {
        fullTicket = await this.jiraService.getIssue(ticketData.key);
      }
      
      // Apply field filtering (hardcoded configuration)
      const filteredTicket = filterJiraTicket(fullTicket);
      
      // Update workflow
      workflow.steps[1] = {
        name: 'selectTicket',
        status: 'completed',
        data: {
          original: ticketData.key,
          filtered: filteredTicket,
          platforms: filteredTicket.platforms,
          testRequirements: filteredTicket.testRequirements
        }
      };
      workflow.currentStep = 2;
      workflow.updatedAt = new Date();
      
      logger.info(`Ticket ${ticketData.key} processed. Platforms: ${filteredTicket.platforms.join(', ')}`);
      
      return {
        success: true,
        filteredTicket,
        nextStep: 'selectContext'
      };
    } catch (error) {
      logger.error(`Error in selectTicket: ${error.message}`);
      workflow.steps[1].status = 'error';
      workflow.steps[1].error = error.message;
      throw error;
    }
  }

  /**
   * Execute Step 2: Select TestRail context for training
   */
  async selectContext(workflowId, contextData) {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) throw new Error('Workflow not found');
    
    try {
      logger.info(`Step 2: Selecting TestRail context for workflow ${workflowId}`);
      
      const { projectId, suiteId, sectionId } = contextData;
      
      // Fetch FULL test cases from selected folder/section with all details
      const testCases = await this.testRailService.getTestCases(projectId, suiteId, sectionId);
      
      logger.info(`Fetched ${testCases.length} test cases from section ${sectionId}`);
      
      // Analyze patterns in existing tests
      const patterns = await this.analyzeTestPatterns(testCases);
      
      // Learn from TestRail patterns
      await patternLearningService.learnFromTestRail(testCases);
      
      // Keep more examples for better context (up to 10)
      const examples = testCases.slice(0, 10).map(tc => ({
        title: tc.title,
        priority: tc.priority,
        preconditions: tc.preconditions,
        steps: tc.steps,
        description: tc.description
      }));
      
      workflow.steps[2] = {
        name: 'selectContext',
        status: 'completed',
        data: {
          projectId,
          suiteId,
          sectionId,
          testCount: testCases.length,
          patterns,
          examples, // Now contains full test details
          testCaseSummary: this.summarizeTestCases(testCases)
        }
      };
      workflow.currentStep = 3;
      workflow.updatedAt = new Date();
      
      logger.info(`Context selected: ${testCases.length} tests analyzed from TestRail`);
      
      return {
        success: true,
        patterns,
        testCount: testCases.length,
        nextStep: 'generateTests'
      };
    } catch (error) {
      logger.error(`Error in selectContext: ${error.message}`);
      workflow.steps[2].status = 'error';
      workflow.steps[2].error = error.message;
      throw error;
    }
  }

  /**
   * Execute Step 3: Generate test cases with AI
   */
  async generateTests(workflowId, options = {}) {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) throw new Error('Workflow not found');
    
    try {
      logger.info(`Step 3: Generating tests for workflow ${workflowId}`);
      
      // Get ticket and context from previous steps
      if (!workflow.steps[1].data || !workflow.steps[2].data) {
        throw new Error('Missing required data from previous steps. Please complete ticket selection and context selection first.');
      }
      
      const ticket = workflow.steps[1].data.filtered;
      const context = workflow.steps[2].data;
      
      // Prepare generation options with patterns
      const generationOptions = {
        ...options,
        patterns: context.patterns,
        examples: context.examples,
        platforms: ticket.platforms,
        testRequirements: ticket.testRequirements
      };
      
      // Generate test cases using AI with context
      logger.info(`Calling Gemini service to generate tests for ticket: ${ticket.key}`);
      const generatedTests = await this.geminiService.generateTestCases(
        ticket,
        generationOptions
      );
      logger.info(`Gemini service returned ${generatedTests?.length || 0} tests`);
      
      // Calculate quality score based on pattern matching
      const qualityScore = this.calculateQualityScore(generatedTests, context.patterns);
      
      workflow.steps[3] = {
        name: 'generateTests',
        status: 'completed',
        data: {
          tests: generatedTests,
          qualityScore,
          generatedAt: new Date()
        }
      };
      workflow.currentStep = 4;
      workflow.updatedAt = new Date();
      
      logger.info(`Generated ${generatedTests.length} tests with quality score: ${qualityScore}%`);
      
      return {
        success: true,
        tests: generatedTests,
        qualityScore,
        nextStep: 'reviewTests'
      };
    } catch (error) {
      logger.error(`Error in generateTests: ${error.message}`);
      workflow.steps[3].status = 'error';
      workflow.steps[3].error = error.message;
      throw error;
    }
  }

  /**
   * Execute Step 4: Review and edit tests
   */
  async reviewTests(workflowId, reviewedTests) {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) throw new Error('Workflow not found');
    
    try {
      logger.info(`Step 4: Reviewing tests for workflow ${workflowId}`);
      
      workflow.steps[4] = {
        name: 'reviewTests',
        status: 'completed',
        data: {
          originalTests: workflow.steps[3].data.tests,
          reviewedTests,
          changes: this.diffTests(workflow.steps[3].data.tests, reviewedTests),
          reviewedAt: new Date()
        }
      };
      workflow.currentStep = 5;
      workflow.updatedAt = new Date();
      
      logger.info(`Tests reviewed. ${reviewedTests.length} tests ready for saving`);
      
      return {
        success: true,
        reviewedTests,
        nextStep: 'saveToTestRail'
      };
    } catch (error) {
      logger.error(`Error in reviewTests: ${error.message}`);
      workflow.steps[4].status = 'error';
      workflow.steps[4].error = error.message;
      throw error;
    }
  }

  /**
   * Execute Step 5: Save tests to TestRail
   */
  async saveToTestRail(workflowId, saveOptions) {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) throw new Error('Workflow not found');
    
    try {
      logger.info(`Step 5: Saving to TestRail for workflow ${workflowId}`);
      
      const tests = workflow.steps[4].data.reviewedTests;
      const { projectId, suiteId, sectionId } = saveOptions;
      
      const savedTests = [];
      
      for (const test of tests) {
        try {
          // Format test for TestRail API
          const testRailTest = {
            title: test.title,
            type_id: 1, // Manual test
            priority_id: this.mapPriority(test.priority),
            refs: workflow.steps[1].data.original, // Link to JIRA ticket
            custom_preconds: test.preconditions,
            custom_steps: this.formatStepsForTestRail(test.steps),
            custom_expected: test.expectedResult,
            section_id: sectionId
          };
          
          // Save to TestRail
          const saved = await this.testRailService.addTestCase(
            sectionId,
            testRailTest
          );
          
          savedTests.push({
            ...test,
            testRailId: saved.id,
            testRailUrl: `${this.testRailService.baseURL}index.php?/cases/view/${saved.id}`
          });
        } catch (error) {
          logger.error(`Failed to save test "${test.title}": ${error.message}`);
          savedTests.push({
            ...test,
            error: error.message
          });
        }
      }
      
      workflow.steps[5] = {
        name: 'saveToTestRail',
        status: 'completed',
        data: {
          savedTests,
          totalSaved: savedTests.filter(t => t.testRailId).length,
          totalFailed: savedTests.filter(t => t.error).length,
          savedAt: new Date()
        }
      };
      workflow.currentStep = 6;
      workflow.updatedAt = new Date();
      
      logger.info(`Saved ${savedTests.filter(t => t.testRailId).length}/${tests.length} tests to TestRail`);
      
      return {
        success: true,
        savedTests,
        nextStep: 'generateCypress'
      };
    } catch (error) {
      logger.error(`Error in saveToTestRail: ${error.message}`);
      workflow.steps[5].status = 'error';
      workflow.steps[5].error = error.message;
      throw error;
    }
  }

  /**
   * Execute Step 6: Generate Cypress tests (optional)
   */
  async generateCypress(workflowId, cypressOptions = {}) {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) throw new Error('Workflow not found');
    
    try {
      logger.info(`Step 6: Generating Cypress tests for workflow ${workflowId}`);
      
      const tests = workflow.steps[4].data.reviewedTests;
      const ticket = workflow.steps[1].data.filtered;
      
      const cypressTests = [];
      
      for (const test of tests) {
        const cypressCode = await this.cypressGenerator.generateTest(test, {
          ...cypressOptions,
          ticket,
          platforms: ticket.platforms
        });
        
        cypressTests.push({
          testName: test.title,
          code: cypressCode.code,
          fileName: cypressCode.fileName
        });
      }
      
      workflow.steps[6] = {
        name: 'generateCypress',
        status: 'completed',
        data: {
          cypressTests,
          generatedAt: new Date()
        }
      };
      workflow.status = 'completed';
      workflow.updatedAt = new Date();
      
      logger.info(`Generated ${cypressTests.length} Cypress tests`);
      
      return {
        success: true,
        cypressTests,
        workflowComplete: true
      };
    } catch (error) {
      logger.error(`Error in generateCypress: ${error.message}`);
      workflow.steps[6].status = 'error';
      workflow.steps[6].error = error.message;
      throw error;
    }
  }

  /**
   * Get workflow status
   */
  getWorkflow(workflowId) {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) throw new Error('Workflow not found');
    return workflow;
  }

  /**
   * Recreate workflow after server restart
   */
  async recreateWorkflow(workflowId, userId) {
    const workflow = {
      id: workflowId,
      userId,
      status: 'in_progress',
      currentStep: 2, // Assume we're at least on step 2 if recreating
      steps: {
        1: { name: 'selectTicket', status: 'completed', data: null },
        2: { name: 'selectContext', status: 'pending', data: null },
        3: { name: 'generateTests', status: 'pending', data: null },
        4: { name: 'reviewTests', status: 'pending', data: null },
        5: { name: 'saveToTestRail', status: 'pending', data: null },
        6: { name: 'generateCypress', status: 'optional', data: null }
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    this.workflows.set(workflowId, workflow);
    logger.info(`Recreated workflow ${workflowId} for user ${userId}`);
    return workflow;
  }

  /**
   * Get all workflows for a user
   */
  getUserWorkflows(userId) {
    const userWorkflows = [];
    for (const [id, workflow] of this.workflows) {
      if (workflow.userId === userId) {
        userWorkflows.push(workflow);
      }
    }
    return userWorkflows;
  }

  // Helper methods

  async analyzeTestPatterns(testCases) {
    const patterns = {
      naming: [],
      steps: [],
      assertions: [],
      priorities: {},
      avgStepsCount: 0,
      commonPreconditions: []
    };
    
    let totalSteps = 0;
    const preconditions = new Map();
    
    testCases.forEach(test => {
      // Extract naming patterns
      if (test.title) {
        const namePattern = test.title.match(/^(\w+)\s*-\s*(.+)/);
        if (namePattern) {
          patterns.naming.push(namePattern[1]);
        }
      }
      
      // Count priorities
      if (test.priority_id) {
        patterns.priorities[test.priority_id] = (patterns.priorities[test.priority_id] || 0) + 1;
      }
      
      // Count preconditions
      if (test.preconditions) {
        const count = preconditions.get(test.preconditions) || 0;
        preconditions.set(test.preconditions, count + 1);
      }
      
      // Extract common step patterns from structured steps
      if (test.steps && Array.isArray(test.steps)) {
        totalSteps += test.steps.length;
        test.steps.forEach(step => {
          const content = step.content || '';
          if (content.includes('Navigate to')) patterns.steps.push('navigation');
          if (content.includes('Click')) patterns.steps.push('interaction');
          if (content.includes('Verify') || content.includes('Validate')) patterns.assertions.push('verification');
          if (content.includes('should')) patterns.assertions.push('assertion');
        });
      }
    });
    
    // Calculate average steps
    patterns.avgStepsCount = testCases.length > 0 ? Math.round(totalSteps / testCases.length) : 5;
    
    // Get most common preconditions
    patterns.commonPreconditions = Array.from(preconditions.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([precond, count]) => precond);
    
    return patterns;
  }

  summarizeTestCases(testCases) {
    const summary = {
      total: testCases.length,
      byPriority: {},
      avgStepsPerTest: 0,
      commonThemes: []
    };
    
    let totalSteps = 0;
    const themes = new Map();
    
    testCases.forEach(tc => {
      // Count by priority
      summary.byPriority[tc.priority] = (summary.byPriority[tc.priority] || 0) + 1;
      
      // Count steps
      if (tc.steps && Array.isArray(tc.steps)) {
        totalSteps += tc.steps.length;
      }
      
      // Extract themes from titles
      const words = tc.title.toLowerCase().split(/\s+/);
      words.forEach(word => {
        if (word.length > 4) { // Only count meaningful words
          themes.set(word, (themes.get(word) || 0) + 1);
        }
      });
    });
    
    summary.avgStepsPerTest = testCases.length > 0 ? Math.round(totalSteps / testCases.length) : 5;
    summary.commonThemes = Array.from(themes.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([theme]) => theme);
    
    return summary;
  }

  calculateQualityScore(generatedTests, patterns) {
    let score = 70; // Base score
    
    // Check if naming follows pattern
    if (patterns.naming.length > 0) {
      const followsNaming = generatedTests.every(test => 
        patterns.naming.some(pattern => test.title.includes(pattern))
      );
      if (followsNaming) score += 10;
    }
    
    // Check if steps follow patterns
    if (patterns.steps.length > 0) {
      score += 10;
    }
    
    // Check completeness
    if (generatedTests.every(test => test.steps && test.steps.length > 0)) {
      score += 10;
    }
    
    return Math.min(score, 100);
  }

  diffTests(original, reviewed) {
    const changes = [];
    // Simple diff - could be enhanced
    if (original.length !== reviewed.length) {
      changes.push(`Test count changed: ${original.length} → ${reviewed.length}`);
    }
    return changes;
  }

  mapPriority(priority) {
    const priorityMap = {
      'Critical': 1,
      'High': 2,
      'Medium': 3,
      'Low': 4
    };
    return priorityMap[priority] || 3;
  }

  formatStepsForTestRail(steps) {
    if (!steps || steps.length === 0) return '';
    
    return steps.map((step, index) => {
      if (typeof step === 'string') {
        return `${index + 1}. ${step}`;
      }
      return `${index + 1}. ${step.action}\nExpected: ${step.expected}`;
    }).join('\n');
  }
}

// Singleton instance
const workflowOrchestrator = new WorkflowOrchestrator();
export default workflowOrchestrator;