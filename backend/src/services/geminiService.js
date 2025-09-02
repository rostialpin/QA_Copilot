import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from '../utils/logger.js';
import { getConfluenceService } from './confluenceService.js';
import patternLearningService from './patternLearningService.js';

export class GeminiService {
  constructor() {
    // Support both direct API key and Google Application Credentials
    this.apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    this.currentModel = process.env.GEMINI_MODEL || 'gemini-2.5-pro';
    
    if (!this.apiKey && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      logger.warn('Gemini/Google AI not configured. Set either GOOGLE_API_KEY or GOOGLE_APPLICATION_CREDENTIALS');
      return;
    }

    if (this.apiKey) {
      // Use direct API key for Gemini
      this.genAI = new GoogleGenerativeAI(this.apiKey);
      this.initializeModel(this.currentModel);
    } else {
      // For Vertex AI, you would need different initialization
      logger.info(`Google AI configured with service account: ${process.env.GOOGLE_APPLICATION_CREDENTIALS}`);
      // Note: For Vertex AI, you'd need to use @google-cloud/aiplatform instead
    }
  }

  initializeModel(modelName) {
    if (!this.genAI) return;
    
    this.model = this.genAI.getGenerativeModel({ model: modelName });
    this.currentModel = modelName;
    logger.info(`Gemini API configured with model: ${modelName}`);
  }

  getCurrentModel() {
    return this.currentModel;
  }

  async setModel(modelName) {
    const validModels = ['gemini-2.5-flash', 'gemini-2.5-pro'];
    if (!validModels.includes(modelName)) {
      throw new Error(`Invalid model name. Must be one of: ${validModels.join(', ')}`);
    }

    this.initializeModel(modelName);
    logger.info(`Model switched to: ${modelName}`);
    return modelName;
  }

  async generateTestCases(ticket, options = {}) {
    // Fetch Confluence documentation if available
    const confluenceService = getConfluenceService();
    const documentation = await confluenceService.fetchTicketDocumentation(ticket);
    
    if (documentation && documentation.scenarios.length > 0) {
      logger.info(`Found ${documentation.scenarios.length} scenarios from Confluence`);
      // Enhance ticket with Confluence data
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
    
    if (!this.model) {
      logger.warn('Gemini API not configured, returning mock test cases');
      logger.warn('API Key status:', this.apiKey ? 'Present' : 'Missing');
      logger.warn('Model status:', this.currentModel);
      const mockResult = this.generateMockTestCases(ticket, options);
      return mockResult.testCases || [];
    }

    const prompt = this.buildTestCasePrompt(ticket, options);
    logger.info('Generating tests with Gemini API for ticket:', ticket.key);
    
    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      logger.info('Gemini API response received, parsing test cases');
      const parsed = this.parseTestCases(text);
      // Extract testCases array from the parsed result
      return parsed.testCases || [];
    } catch (error) {
      logger.error('Gemini API error:', error);
      logger.warn('Falling back to mock test cases due to API error');
      const mockResult = this.generateMockTestCases(ticket, options);
      return mockResult.testCases || [];
    }
  }

  generateMockTestCases(ticket, options = {}) {
    const { style = 'BDD' } = options;
    
    // If we have Confluence scenarios, use them to generate specific test cases
    if (ticket.confluenceScenarios && ticket.confluenceScenarios.length > 0) {
      return this.generateTestsFromConfluenceScenarios(ticket, options);
    }
    
    // Check if this is an Eden ticket
    const isEdenTicket = this.isEdenTicket(ticket);
    
    if (isEdenTicket) {
      return this.generateEdenTestCases(ticket, options);
    }
    
    // Generate more specific mock test cases based on ticket type
    let mockTestCases = [];
    
    if (ticket.type?.toLowerCase() === 'bug') {
      // Parse steps to reproduce if provided
      const steps = this.parseStepsToReproduce(ticket.stepsToReproduce || ticket.description);
      const actualBehavior = ticket.actualBehavior || 'System does not behave as expected';
      const expectedBehavior = ticket.expectedBehavior || 'System should work correctly';
      
      mockTestCases = [
        {
          title: `Verify Bug Fix: ${ticket.summary}`,
          objective: `Verify that the bug has been fixed and the system now works as expected`,
          preconditions: `Bug fix deployed to test environment. ${this.extractPreconditions(ticket)}`,
          priority: 'High',
          steps: steps.length > 0 ? 
            steps.map((step, idx) => ({
              action: step,
              expected: idx === steps.length - 1 ? 
                expectedBehavior : 
                this.getStepExpectedResult(step)
            })) : 
            [
              { action: 'Navigate to the affected feature', expected: 'Feature loads correctly' },
              { action: 'Perform the action that previously caused the bug', expected: expectedBehavior },
              { action: 'Verify the correct behavior', expected: 'System functions as intended' }
            ],
          expectedResult: `✅ PASS: ${expectedBehavior} | ❌ FAIL: Bug still exists if ${actualBehavior}`
        },
        {
          title: `Edge Case Testing: ${ticket.summary}`,
          objective: `Test the fix with various data sets and scenarios to ensure complete resolution`,
          preconditions: `Bug fix deployed. ${this.extractPreconditions(ticket)}`,
          priority: 'High',
          steps: this.generateBugEdgeCaseSteps(ticket, expectedBehavior),
          expectedResult: `All variations work correctly: ${expectedBehavior}`
        },
        {
          title: `Regression Test: ${ticket.summary}`,
          objective: `Ensure the fix doesn't break existing functionality`,
          preconditions: this.extractPreconditions(ticket),
          priority: 'Medium',
          steps: this.generateRegressionSteps(ticket, expectedBehavior),
          expectedResult: 'No regression issues - all related features continue to work'
        },
        {
          title: `Performance Impact: ${ticket.summary}`,
          objective: `Verify the bug fix doesn't negatively impact performance`,
          preconditions: `Performance monitoring tools available. ${this.extractPreconditions(ticket)}`,
          priority: 'Medium',
          steps: [
            { action: 'Establish baseline performance metrics', expected: 'Baseline recorded' },
            { action: 'Execute the fixed functionality under normal load', expected: 'Response time within acceptable limits' },
            { action: 'Compare metrics with baseline', expected: 'No significant performance degradation' }
          ],
          expectedResult: 'Performance remains within acceptable thresholds after bug fix'
        },
        {
          title: `Cross-Platform Verification: ${ticket.summary}`,
          objective: `Ensure the bug fix works across all supported platforms`,
          preconditions: `Access to all supported platforms. ${this.extractPreconditions(ticket)}`,
          priority: 'High',
          steps: [
            { action: 'Test fix on primary platform', expected: 'Bug is fixed on primary platform' },
            { action: 'Test fix on secondary platforms', expected: 'Bug is fixed on all platforms' },
            { action: 'Verify consistent behavior across platforms', expected: 'Behavior is consistent' }
          ],
          expectedResult: 'Bug fix is effective and consistent across all platforms'
        }
      ];
    } else {
      // Story/Task/Enhancement
      const acceptanceCriteria = this.parseAcceptanceCriteria(ticket.acceptanceCriteria || ticket.description);
      const qaScenarios = this.extractQAValidationScenarios(ticket);
      
      // If QA scenarios are found, prioritize them
      if (qaScenarios.length > 0) {
        mockTestCases = this.generateTestsFromQAScenarios(ticket, qaScenarios, acceptanceCriteria);
      } else {
        const featureSteps = this.generateFeatureSteps(ticket, acceptanceCriteria);
        mockTestCases = [
        {
          title: `Happy Path: ${ticket.summary}`,
          objective: `Validate that all acceptance criteria are met for ${ticket.summary}`,
          preconditions: this.extractPreconditions(ticket),
          priority: 'High',
          steps: featureSteps.happyPath,
          expectedResult: acceptanceCriteria.length > 0 ? 
            `All acceptance criteria are satisfied: ${acceptanceCriteria.join(', ')}` :
            'Feature completes successfully with valid data',
          testData: this.generateTestData(ticket)
        },
        {
          title: `Input Validation: ${ticket.summary}`,
          objective: `Test validation rules and error handling for ${ticket.summary}`,
          preconditions: this.extractPreconditions(ticket),
          priority: 'High',
          steps: featureSteps.validation,
          expectedResult: 'All validation rules work correctly and appropriate error messages are shown',
          testData: this.generateInvalidTestData(ticket)
        },
        {
          title: `Edge Cases: ${ticket.summary}`,
          objective: `Test boundary conditions and special scenarios for ${ticket.summary}`,
          preconditions: this.extractPreconditions(ticket),
          priority: 'Medium',
          steps: featureSteps.edgeCases,
          expectedResult: 'All edge cases are handled gracefully without system errors',
          testData: this.generateEdgeCaseData(ticket)
        },
        {
          title: `Integration Test: ${ticket.summary}`,
          objective: `Verify integration with other system components`,
          preconditions: `All integrated systems available. ${this.extractPreconditions(ticket)}`,
          priority: 'High',
          steps: [
            { action: 'Test data flow to downstream systems', expected: 'Data transmitted correctly' },
            { action: 'Verify upstream dependencies', expected: 'Dependencies functioning properly' },
            { action: 'Check API interactions', expected: 'APIs respond as expected' },
            { action: 'Validate data consistency', expected: 'Data remains consistent across systems' }
          ],
          expectedResult: 'Feature integrates seamlessly with other components',
          testData: this.generateTestData(ticket)
        },
        {
          title: `User Acceptance: ${ticket.summary}`,
          objective: `Verify feature meets user acceptance criteria and business requirements`,
          preconditions: `UAT environment configured. ${this.extractPreconditions(ticket)}`,
          priority: 'High',
          steps: [
            { action: 'Complete user workflow end-to-end', expected: 'Workflow completes successfully' },
            { action: 'Verify business rules implementation', expected: 'Business logic correctly applied' },
            { action: 'Check UI/UX requirements', expected: 'Interface meets specifications' },
            { action: 'Validate user feedback incorporation', expected: 'User requirements satisfied' }
          ],
          expectedResult: 'Feature meets all acceptance criteria and user expectations',
          testData: this.generateTestData(ticket)
        }
      ];
      }
    }

    return { testCases: mockTestCases, style };
  }

  buildTestCasePrompt(ticket, options) {
    const { style = 'BDD', types = ['positive', 'negative', 'edge'] } = options;
    
    // Customize prompt based on ticket type
    let contextualGuidance = '';
    if (ticket.type?.toLowerCase() === 'bug') {
      contextualGuidance = `
This is a BUG ticket. Focus on:
- Reproducing the bug described
- Verifying the fix works correctly
- Testing regression scenarios
- Ensuring the bug doesn't reoccur in edge cases
- Testing related functionality that might be affected`;
    } else if (ticket.type?.toLowerCase() === 'story' || ticket.type?.toLowerCase() === 'task') {
      contextualGuidance = `
This is a ${ticket.type.toUpperCase()} ticket. Focus on:
- Validating all acceptance criteria
- Testing happy path scenarios thoroughly
- Testing error handling and validation
- Checking boundary conditions
- Verifying user experience flows
- Testing integration with existing features
${this.extractQAValidationScenarios(ticket).length > 0 ? 
`\n- CRITICAL: The following QA validation scenarios MUST be tested:
${this.extractQAValidationScenarios(ticket).map((s, i) => `  ${i+1}. ${s}`).join('\n')}` : ''}`;
    } else if (ticket.type?.toLowerCase() === 'improvement' || ticket.type?.toLowerCase() === 'enhancement') {
      contextualGuidance = `
This is an IMPROVEMENT ticket. Focus on:
- Comparing before/after behavior
- Performance improvements if applicable
- Backward compatibility
- User experience enhancements
- Edge cases with the improved feature`;
    }
    
    return `You are an expert QA engineer creating comprehensive test cases for a web application. Generate specific, actionable test cases for this JIRA ticket:

TICKET INFORMATION:
==================
Title: ${ticket.summary}
Type: ${ticket.type || 'Story'}
Description: ${ticket.description || 'No description provided'}
${ticket.type === 'Bug' ? `
Steps to Reproduce: ${ticket.stepsToReproduce || 'Not provided'}
Actual Behavior: ${ticket.actualBehavior || 'System behaves incorrectly'}
Expected Behavior: ${ticket.expectedBehavior || 'System should work correctly'}` : ''}
${ticket.acceptanceCriteria ? `Acceptance Criteria: ${ticket.acceptanceCriteria}` : ''}
${this.extractQAValidationScenarios(ticket).length > 0 ? `
QA VALIDATION REQUIREMENTS:
${this.extractQAValidationScenarios(ticket).map((s, i) => `${i+1}. ${s}`).join('\n')}` : ''}
${ticket.confluenceScenarios && ticket.confluenceScenarios.length > 0 ? `
CONFLUENCE DOCUMENTATION SCENARIOS:
${ticket.confluenceScenarios.map((s, i) => `${i+1}. ${s}`).join('\n')}` : ''}
${ticket.technicalSpecs ? `
TECHNICAL SPECIFICATIONS:
${ticket.technicalSpecs.endpoints?.length > 0 ? `Endpoints: ${JSON.stringify(ticket.technicalSpecs.endpoints)}` : ''}
${ticket.technicalSpecs.uiElements?.length > 0 ? `UI Elements: ${ticket.technicalSpecs.uiElements.join(', ')}` : ''}
${ticket.technicalSpecs.events?.length > 0 ? `Events: ${ticket.technicalSpecs.events.join(', ')}` : ''}` : ''}
${contextualGuidance}

REQUIREMENTS:
=============
Generate ${types.length} to ${types.length + 2} test cases covering:
${types.includes('positive') ? '- Positive/Happy path scenarios' : ''}
${types.includes('negative') ? '- Negative scenarios and error handling' : ''}
${types.includes('edge') ? '- Edge cases and boundary conditions' : ''}

Each test case MUST include:
1. title: Clear, specific test case title
2. objective: What this test validates (1-2 sentences)
3. preconditions: Specific setup requirements
4. priority: "High", "Medium", or "Low"
5. steps: Array of step objects, each with:
   - action: Specific user action (e.g., "Click the 'Submit' button", "Enter 'test@example.com' in email field")
   - expected: Specific expected result (e.g., "Error message 'Invalid email' appears", "Page redirects to dashboard")
6. expectedResult: Overall expected outcome
7. testData: Specific test data if needed (optional)

CRITICAL INSTRUCTIONS FOR SPECIFICITY:
- NEVER use generic placeholders like "the feature" or "the system"
- ALWAYS use the specific feature names and UI elements from the ticket
- Include EXACT error messages, button labels, and field names
- Provide REAL test data values (emails, passwords, dates, etc.)
- Each step must be so specific that a new tester could execute it without confusion
- Expected results must be measurable and observable
- For bugs: Focus on verifying the fix works, not reproducing the original issue
- Include specific browser/device requirements if mentioned

Format your response as a JSON array of test case objects. Example format:
[
  {
    "title": "Verify user can successfully login with valid credentials",
    "objective": "Validate that users can access the system with correct username and password",
    "preconditions": "User account 'testuser@example.com' exists with password 'Test123!'",
    "priority": "High",
    "steps": [
      {"action": "Navigate to login page at /login", "expected": "Login form is displayed with email and password fields"},
      {"action": "Enter 'testuser@example.com' in the email field", "expected": "Email is accepted and displayed in the field"},
      {"action": "Enter 'Test123!' in the password field", "expected": "Password is masked with dots"},
      {"action": "Click the 'Sign In' button", "expected": "Loading spinner appears briefly"}
    ],
    "expectedResult": "User is redirected to dashboard at /dashboard and sees welcome message",
    "testData": {"email": "testuser@example.com", "password": "Test123!"}
  }
]`;
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

  getStepExpectedResult(step) {
    const stepLower = step.toLowerCase();
    
    if (stepLower.includes('navigate') || stepLower.includes('go to') || stepLower.includes('open')) {
      return 'Page/screen loads successfully';
    }
    if (stepLower.includes('click') || stepLower.includes('tap') || stepLower.includes('press')) {
      return 'Element responds to interaction';
    }
    if (stepLower.includes('enter') || stepLower.includes('type') || stepLower.includes('input')) {
      return 'Input accepted and displayed';
    }
    if (stepLower.includes('select') || stepLower.includes('choose')) {
      return 'Option selected successfully';
    }
    if (stepLower.includes('wait') || stepLower.includes('load')) {
      return 'Process completes within acceptable time';
    }
    if (stepLower.includes('verify') || stepLower.includes('check')) {
      return 'Verification successful';
    }
    
    return 'Action completed successfully';
  }

  parseStepsToReproduce(text) {
    if (!text) return [];
    
    // Try to parse numbered steps
    const numberedSteps = text.match(/\d+\.\s+[^\n]+/g);
    if (numberedSteps && numberedSteps.length > 0) {
      return numberedSteps.map(step => step.replace(/^\d+\.\s+/, ''));
    }
    
    // Try to parse bullet points
    const bulletSteps = text.match(/[•\-\*]\s+[^\n]+/g);
    if (bulletSteps && bulletSteps.length > 0) {
      return bulletSteps.map(step => step.replace(/^[•\-\*]\s+/, ''));
    }
    
    // Try to parse line-by-line if it contains action words
    const lines = text.split('\n').filter(line => line.trim());
    const actionWords = ['navigate', 'click', 'enter', 'select', 'open', 'go to', 'type', 'submit', 'press', 'tap'];
    const actionSteps = lines.filter(line => 
      actionWords.some(word => line.toLowerCase().includes(word))
    );
    
    if (actionSteps.length > 0) {
      return actionSteps;
    }
    
    // If no clear steps, return the description split by sentences
    const sentences = text.match(/[^.!?]+[.!?]+/g);
    if (sentences && sentences.length > 1 && sentences.length <= 10) {
      return sentences.map(s => s.trim());
    }
    
    return [];
  }

  extractPreconditions(ticket) {
    // Extract preconditions from various possible sources
    if (ticket.preconditions) {
      return ticket.preconditions;
    }
    
    // Try to extract from description
    const description = ticket.description || '';
    const preconditionMatch = description.match(/precondition[s]?:\s*([^\n]+)/i);
    if (preconditionMatch) {
      return preconditionMatch[1];
    }
    
    // Generate based on ticket context
    if (ticket.type?.toLowerCase() === 'bug') {
      if (description.toLowerCase().includes('login')) {
        return 'User has valid credentials and access to the application';
      }
      if (description.toLowerCase().includes('mobile')) {
        return 'Application is accessible on mobile device with stable internet connection';
      }
      if (description.toLowerCase().includes('api')) {
        return 'API endpoints are accessible and test data is available';
      }
    }
    
    return 'Application is accessible and test environment is properly configured';
  }

  generateBugEdgeCaseSteps(ticket, expectedBehavior) {
    const description = (ticket.description || '').toLowerCase();
    const summary = (ticket.summary || '').toLowerCase();
    const steps = [];
    
    // Test with different data variations
    steps.push(
      { action: 'Test with minimum valid input values', expected: expectedBehavior },
      { action: 'Test with maximum valid input values', expected: expectedBehavior },
      { action: 'Test with special characters if applicable', expected: expectedBehavior }
    );
    
    // Add context-specific edge cases
    if (description.includes('mobile') || summary.includes('mobile')) {
      steps.push(
        { action: 'Test on different mobile browsers (Chrome, Safari, Firefox)', expected: expectedBehavior },
        { action: 'Test with different screen orientations', expected: expectedBehavior },
        { action: 'Test with slow network connection', expected: expectedBehavior }
      );
    }
    
    if (description.includes('login') || summary.includes('login')) {
      steps.push(
        { action: 'Test with recently created account', expected: expectedBehavior },
        { action: 'Test with old existing account', expected: expectedBehavior },
        { action: 'Test rapid login attempts', expected: expectedBehavior },
        { action: 'Test after password reset', expected: expectedBehavior }
      );
    }
    
    if (description.includes('form') || description.includes('submit')) {
      steps.push(
        { action: 'Test with all optional fields empty', expected: expectedBehavior },
        { action: 'Test with all fields filled', expected: expectedBehavior },
        { action: 'Test double-click on submit', expected: 'No duplicate submissions' }
      );
    }
    
    // Always add browser/environment variations
    steps.push(
      { action: 'Test after clearing cache and cookies', expected: expectedBehavior },
      { action: 'Test in incognito/private mode', expected: expectedBehavior }
    );
    
    return steps;
  }

  generateRegressionSteps(ticket, expectedBehavior) {
    const description = (ticket.description || '').toLowerCase();
    const summary = (ticket.summary || '').toLowerCase();
    const steps = [];
    
    // Add context-specific regression tests
    if (description.includes('login') || summary.includes('login')) {
      steps.push(
        { action: 'Test login with different user roles', expected: 'All user types can login successfully' },
        { action: 'Test logout functionality', expected: 'Logout works correctly' },
        { action: 'Test session management', expected: 'Sessions are handled properly' }
      );
    } else if (description.includes('api') || summary.includes('api')) {
      steps.push(
        { action: 'Test API with valid authentication', expected: 'API responds correctly' },
        { action: 'Test API error handling', expected: 'Errors are handled gracefully' },
        { action: 'Test API response times', expected: 'Performance is acceptable' }
      );
    } else if (description.includes('form') || description.includes('input')) {
      steps.push(
        { action: 'Test form validation for all fields', expected: 'Validation rules work correctly' },
        { action: 'Test form submission with valid data', expected: 'Data is saved successfully' },
        { action: 'Test form reset/cancel functionality', expected: 'Form can be cleared/cancelled' }
      );
    } else {
      // Generic regression steps
      steps.push(
        { action: 'Test related features in the same module', expected: 'All related features work normally' },
        { action: 'Verify data persistence after the fix', expected: 'Data is saved and retrieved correctly' },
        { action: 'Check for any console errors or warnings', expected: 'No new errors introduced' }
      );
    }
    
    // Add specific step about the fixed behavior
    steps.unshift({
      action: 'Verify the fixed functionality multiple times',
      expected: `Consistently shows: ${expectedBehavior}`
    });
    
    return steps;
  }

  parseAcceptanceCriteria(text) {
    if (!text) return [];
    
    // Only parse if it looks like explicit acceptance criteria
    const hasAcceptanceHeader = text.toLowerCase().includes('acceptance criteria') || 
                                text.toLowerCase().includes('ac:') ||
                                text.toLowerCase().includes('requirements:');
    
    // Parse bullet points or numbered items ONLY if they look like criteria
    const bullets = text.match(/[•\-\*\d+\.]\s+[^\n]+/g);
    if (bullets && bullets.length > 1) { // Multiple bullet points suggest a list
      const parsedBullets = bullets.map(item => item.replace(/^[•\-\*\d+\.]\s+/, '').trim());
      // Check if these look like acceptance criteria
      const criteriaWords = ['user can', 'user should', 'system should', 'must', 'shall', 'ability to', 'able to'];
      const likelyCriteria = parsedBullets.filter(item => 
        criteriaWords.some(word => item.toLowerCase().includes(word))
      );
      if (likelyCriteria.length >= parsedBullets.length / 2) { // At least half look like criteria
        return parsedBullets;
      }
    }
    
    // If there's an explicit acceptance criteria section, parse it
    if (hasAcceptanceHeader) {
      const lines = text.split('\n').filter(line => line.trim());
      const criteriaWords = ['user can', 'system should', 'must', 'shall', 'ability to', 'able to'];
      const criteria = lines.filter(line => 
        criteriaWords.some(word => line.toLowerCase().includes(word))
      );
      if (criteria.length > 0) {
        return criteria;
      }
    }
    
    return [];
  }

  extractQAValidationScenarios(ticket) {
    const description = ticket.description || '';
    const acceptanceCriteria = ticket.acceptanceCriteria || '';
    const fullText = `${description}\n${acceptanceCriteria}`;
    
    // Look for QA validation section
    const qaPatterns = [
      /QA.*validate.*:([\s\S]*?)(?=\n\n|$)/i,
      /QA.*verify.*:([\s\S]*?)(?=\n\n|$)/i,
      /validation.*scenarios?.*:([\s\S]*?)(?=\n\n|$)/i,
      /test.*scenarios?.*:([\s\S]*?)(?=\n\n|$)/i,
      /scenarios?.*to.*(?:validate|verify|test).*:([\s\S]*?)(?=\n\n|$)/i,
      /(?:validate|verify|test).*on.*prod.*:([\s\S]*?)(?=\n\n|$)/i
    ];
    
    for (const pattern of qaPatterns) {
      const match = fullText.match(pattern);
      if (match && match[1]) {
        // Parse the scenarios from the matched section
        const scenariosText = match[1];
        const scenarios = this.parseScenariosList(scenariosText);
        if (scenarios.length > 0) {
          return scenarios;
        }
      }
    }
    
    // Also check if there's a section that just lists scenarios after certain keywords
    const keywordMatch = fullText.match(/(?:QA|test|validate|verify).*(?:following|these|below|scenarios?).*:([\s\S]*?)(?=\n\n|$)/i);
    if (keywordMatch && keywordMatch[1]) {
      return this.parseScenariosList(keywordMatch[1]);
    }
    
    return [];
  }

  parseScenariosList(text) {
    if (!text) return [];
    
    const scenarios = [];
    
    // Parse numbered items (1. 2. 3. or 1) 2) 3))
    const numberedItems = text.match(/\d+[\)\.]\s*[^\n]+/g);
    if (numberedItems) {
      scenarios.push(...numberedItems.map(item => 
        item.replace(/^\d+[\)\.]\s*/, '').trim()
      ));
    }
    
    // Parse bullet points
    const bulletItems = text.match(/[•\-\*]\s*[^\n]+/g);
    if (bulletItems) {
      scenarios.push(...bulletItems.map(item => 
        item.replace(/^[•\-\*]\s*/, '').trim()
      ));
    }
    
    // If no formatted lists found, try line by line
    if (scenarios.length === 0) {
      const lines = text.split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.match(/^(QA|test|validate|verify)/i));
      scenarios.push(...lines);
    }
    
    return scenarios.filter(s => s.length > 5); // Filter out very short items
  }

  generateTestsFromQAScenarios(ticket, qaScenarios, acceptanceCriteria) {
    const testCases = [];
    
    // Generate a test case for each QA scenario
    qaScenarios.forEach((scenario, index) => {
      const steps = this.convertScenarioToSteps(scenario, ticket);
      
      testCases.push({
        title: `QA Validation ${index + 1}: ${this.summarizeScenario(scenario)}`,
        objective: `Validate: ${scenario}`,
        preconditions: this.extractPreconditions(ticket),
        priority: index === 0 ? 'High' : 'Medium',
        steps: steps,
        expectedResult: `Scenario validated successfully: ${scenario}`,
        testData: this.generateTestData(ticket)
      });
    });
    
    // Add acceptance criteria tests if they're different from QA scenarios
    if (acceptanceCriteria.length > 0) {
      const uniqueCriteria = acceptanceCriteria.filter(ac => 
        !qaScenarios.some(qs => qs.toLowerCase().includes(ac.toLowerCase()))
      );
      
      if (uniqueCriteria.length > 0) {
        testCases.push({
          title: `Acceptance Criteria Validation: ${ticket.summary}`,
          objective: `Verify all acceptance criteria are met`,
          preconditions: this.extractPreconditions(ticket),
          priority: 'High',
          steps: uniqueCriteria.map(criterion => ({
            action: this.extractActionFromCriterion(criterion),
            expected: `Criterion met: ${criterion}`
          })),
          expectedResult: `All acceptance criteria satisfied`,
          testData: this.generateTestData(ticket)
        });
      }
    }
    
    // Add edge case testing
    testCases.push({
      title: `Edge Cases: ${ticket.summary}`,
      objective: `Test boundary conditions and error scenarios`,
      preconditions: this.extractPreconditions(ticket),
      priority: 'Low',
      steps: this.generateEdgeCaseSteps(ticket),
      expectedResult: 'All edge cases handled gracefully',
      testData: this.generateEdgeCaseData(ticket)
    });
    
    return testCases;
  }

  summarizeScenario(scenario) {
    // Create a short title from the scenario
    const words = scenario.split(' ').slice(0, 6).join(' ');
    return words.length < scenario.length ? `${words}...` : words;
  }

  convertScenarioToSteps(scenario, ticket) {
    const steps = [];
    const scenarioLower = scenario.toLowerCase();
    
    // Parse scenario into actionable steps
    if (scenarioLower.includes('navigate') || scenarioLower.includes('go to')) {
      const match = scenario.match(/(?:navigate|go)\s+(?:to\s+)?([^,\.]+)/i);
      if (match) {
        steps.push({
          action: `Navigate to ${match[1].trim()}`,
          expected: 'Page loads successfully'
        });
      }
    }
    
    // Look for verification points
    if (scenarioLower.includes('verify') || scenarioLower.includes('validate') || scenarioLower.includes('check')) {
      const match = scenario.match(/(?:verify|validate|check)\s+(?:that\s+)?([^,\.]+)/i);
      if (match) {
        steps.push({
          action: `Verify ${match[1].trim()}`,
          expected: match[1].trim()
        });
      }
    }
    
    // Look for user actions
    const actionWords = ['click', 'enter', 'select', 'submit', 'upload', 'download', 'create', 'delete', 'update'];
    actionWords.forEach(action => {
      if (scenarioLower.includes(action)) {
        const pattern = new RegExp(`${action}\\s+(?:on\\s+|the\\s+)?([^,\\.]+)`, 'i');
        const match = scenario.match(pattern);
        if (match) {
          steps.push({
            action: `${action.charAt(0).toUpperCase() + action.slice(1)} ${match[1].trim()}`,
            expected: `${action.charAt(0).toUpperCase() + action.slice(1)} action completed successfully`
          });
        }
      }
    });
    
    // If no specific steps were parsed, create a general validation step
    if (steps.length === 0) {
      steps.push({
        action: `Execute scenario: ${scenario}`,
        expected: 'Scenario executes as described'
      });
      steps.push({
        action: 'Verify the outcome',
        expected: 'Expected behavior is observed'
      });
    }
    
    // Always add a final verification step
    steps.push({
      action: 'Confirm scenario completion',
      expected: `Scenario "${this.summarizeScenario(scenario)}" validated successfully`
    });
    
    return steps;
  }

  generateFeatureSteps(ticket, acceptanceCriteria) {
    const description = (ticket.description || '').toLowerCase();
    const summary = (ticket.summary || '').toLowerCase();
    const fullText = `${summary} ${description}`;
    
    // Generate happy path steps based on acceptance criteria or feature analysis
    const happyPath = [];
    
    if (acceptanceCriteria.length > 0) {
      // Generate steps for each acceptance criterion
      acceptanceCriteria.forEach((criterion, index) => {
        const actionVerb = this.extractActionFromCriterion(criterion);
        happyPath.push({
          action: actionVerb,
          expected: `Acceptance criterion met: ${criterion}`
        });
      });
    } else {
      // Analyze the story content to generate intelligent test scenarios
      const scenarios = this.analyzeStoryContent(ticket);
      if (scenarios.length > 0) {
        happyPath.push(...scenarios);
      } else {
        // Fallback to specific patterns based on feature description
        if (fullText.includes('password reset')) {
        happyPath.push(
          { action: 'Navigate to the password reset page', expected: 'Password reset form is displayed' },
          { action: 'Enter registered email address', expected: 'Email field accepts the input' },
          { action: 'Click "Send Reset Link" button', expected: 'Confirmation message appears' },
          { action: 'Check email for reset link', expected: 'Email with reset link is received' },
          { action: 'Click the reset link in email', expected: 'Password reset page opens with token' },
          { action: 'Enter new password and confirmation', expected: 'Password fields accept input' },
          { action: 'Submit new password', expected: 'Success message appears' },
          { action: 'Login with new password', expected: 'Login successful with new credentials' }
        );
        } else if (fullText.includes('registration') || fullText.includes('sign up')) {
        happyPath.push(
          { action: 'Navigate to registration page', expected: 'Registration form is displayed' },
          { action: 'Enter valid email address', expected: 'Email is accepted' },
          { action: 'Enter password meeting requirements', expected: 'Password strength indicator shows strong' },
          { action: 'Enter matching password confirmation', expected: 'Passwords match' },
          { action: 'Accept terms and conditions', expected: 'Checkbox is selected' },
          { action: 'Submit registration form', expected: 'Account created successfully' },
          { action: 'Verify email confirmation', expected: 'Confirmation email received' }
        );
        } else {
          // Generic feature steps as last resort
          happyPath.push(
            { action: `Navigate to ${ticket.summary} feature`, expected: 'Feature is accessible and loads correctly' },
            { action: 'Review the interface and available options', expected: 'All expected elements are present' },
            { action: 'Enter/select required information', expected: 'Input is accepted and validated' },
            { action: 'Submit/save the changes', expected: 'Operation completes successfully' },
            { action: 'Verify the results', expected: 'Changes are applied correctly' }
          );
        }
      }
    }
    
    // Generate validation steps
    const validation = this.generateValidationSteps(ticket);
    
    // Generate edge case steps
    const edgeCases = this.generateEdgeCaseSteps(ticket);
    
    return { happyPath, validation, edgeCases };
  }

  analyzeStoryContent(ticket) {
    const steps = [];
    const description = ticket.description || '';
    const summary = ticket.summary || '';
    const fullText = `${summary} ${description}`.toLowerCase();
    
    // Extract key features and actions from the story
    const features = this.extractFeatures(fullText);
    const actions = this.extractActions(fullText);
    const entities = this.extractEntities(fullText);
    
    // Build test scenarios based on extracted information
    
    // 1. Navigation/Access scenarios
    if (features.page || features.screen || features.modal || features.dialog) {
      const featureName = features.page || features.screen || features.modal || features.dialog;
      steps.push({
        action: `Navigate to ${featureName}`,
        expected: `${featureName} loads successfully with all elements visible`
      });
    }
    
    // 2. CRUD operation scenarios
    if (actions.create || fullText.includes('add') || fullText.includes('new')) {
      const entity = entities[0] || 'item';
      steps.push(
        { action: `Click on 'Add ${entity}' or 'Create' button`, expected: 'Creation form/modal opens' },
        { action: `Fill in all required fields for ${entity}`, expected: 'Fields accept valid input' },
        { action: 'Submit the creation form', expected: `New ${entity} is created successfully` },
        { action: `Verify ${entity} appears in the list/view`, expected: `${entity} is visible with correct details` }
      );
    }
    
    if (actions.update || actions.edit || fullText.includes('modify')) {
      const entity = entities[0] || 'item';
      steps.push(
        { action: `Select an existing ${entity} to edit`, expected: 'Edit form/mode opens with current data' },
        { action: 'Modify one or more fields', expected: 'Fields are editable and accept new values' },
        { action: 'Save the changes', expected: 'Changes are saved successfully' },
        { action: 'Verify the updates persist', expected: 'Updated values are displayed correctly' }
      );
    }
    
    if (actions.delete || actions.remove) {
      const entity = entities[0] || 'item';
      steps.push(
        { action: `Select ${entity} to delete`, expected: `${entity} is selected` },
        { action: 'Click delete/remove button', expected: 'Confirmation dialog appears' },
        { action: 'Confirm deletion', expected: `${entity} is removed from the system` },
        { action: 'Verify deletion', expected: `${entity} no longer appears in lists/searches` }
      );
    }
    
    if (actions.search || actions.filter || fullText.includes('find')) {
      steps.push(
        { action: 'Enter search criteria', expected: 'Search field accepts input' },
        { action: 'Execute search', expected: 'Search results are displayed' },
        { action: 'Verify search results', expected: 'Results match search criteria' },
        { action: 'Clear search', expected: 'All items are displayed again' }
      );
    }
    
    // 3. Integration scenarios
    if (fullText.includes('integrate') || fullText.includes('connect') || fullText.includes('sync')) {
      steps.push(
        { action: 'Access integration settings', expected: 'Integration options are displayed' },
        { action: 'Configure integration parameters', expected: 'Configuration is accepted' },
        { action: 'Test the integration', expected: 'Connection is successful' },
        { action: 'Verify data flow', expected: 'Data syncs correctly between systems' }
      );
    }
    
    // 4. Permission/Role scenarios
    if (fullText.includes('permission') || fullText.includes('role') || fullText.includes('access')) {
      steps.push(
        { action: 'Test with different user roles', expected: 'Each role sees appropriate options' },
        { action: 'Verify restricted actions', expected: 'Unauthorized actions are blocked' },
        { action: 'Test permission inheritance', expected: 'Permissions cascade correctly' }
      );
    }
    
    // 5. Workflow scenarios
    if (fullText.includes('workflow') || fullText.includes('process') || fullText.includes('approval')) {
      steps.push(
        { action: 'Initiate the workflow', expected: 'Workflow starts successfully' },
        { action: 'Complete first step/stage', expected: 'Workflow advances to next stage' },
        { action: 'Verify notifications sent', expected: 'Appropriate users are notified' },
        { action: 'Complete the workflow', expected: 'Workflow completes with expected outcome' }
      );
    }
    
    // 6. Report/Analytics scenarios
    if (fullText.includes('report') || fullText.includes('analytics') || fullText.includes('dashboard')) {
      steps.push(
        { action: 'Access reporting section', expected: 'Reports/dashboard loads' },
        { action: 'Select date range or filters', expected: 'Filters are applied' },
        { action: 'Generate report', expected: 'Report displays correct data' },
        { action: 'Export report', expected: 'Report exports in selected format' }
      );
    }
    
    // 7. Settings/Configuration scenarios
    if (fullText.includes('setting') || fullText.includes('config') || fullText.includes('preference')) {
      steps.push(
        { action: 'Access settings/configuration', expected: 'Settings page opens' },
        { action: 'Modify configuration values', expected: 'Changes are accepted' },
        { action: 'Save configuration', expected: 'Settings are saved' },
        { action: 'Verify changes take effect', expected: 'System behavior reflects new settings' }
      );
    }
    
    // 8. Notification scenarios
    if (fullText.includes('notification') || fullText.includes('alert') || fullText.includes('email')) {
      steps.push(
        { action: 'Trigger notification event', expected: 'Notification is generated' },
        { action: 'Check notification delivery', expected: 'Notification received by correct recipients' },
        { action: 'Verify notification content', expected: 'Content is accurate and complete' },
        { action: 'Test notification preferences', expected: 'User preferences are respected' }
      );
    }
    
    return steps;
  }

  extractFeatures(text) {
    const features = {};
    
    // Look for UI components
    if (text.includes('page')) features.page = text.match(/([\w\s]+)\s+page/)?.[1]?.trim() || 'the page';
    if (text.includes('screen')) features.screen = text.match(/([\w\s]+)\s+screen/)?.[1]?.trim() || 'the screen';
    if (text.includes('modal')) features.modal = text.match(/([\w\s]+)\s+modal/)?.[1]?.trim() || 'the modal';
    if (text.includes('dialog')) features.dialog = text.match(/([\w\s]+)\s+dialog/)?.[1]?.trim() || 'the dialog';
    if (text.includes('form')) features.form = text.match(/([\w\s]+)\s+form/)?.[1]?.trim() || 'the form';
    
    return features;
  }

  extractActions(text) {
    const actions = {};
    
    // CRUD operations
    if (text.includes('create') || text.includes('add') || text.includes('new')) actions.create = true;
    if (text.includes('read') || text.includes('view') || text.includes('display')) actions.read = true;
    if (text.includes('update') || text.includes('edit') || text.includes('modify')) actions.update = true;
    if (text.includes('delete') || text.includes('remove')) actions.delete = true;
    
    // Other common actions
    if (text.includes('search') || text.includes('find')) actions.search = true;
    if (text.includes('filter')) actions.filter = true;
    if (text.includes('sort')) actions.sort = true;
    if (text.includes('export')) actions.export = true;
    if (text.includes('import')) actions.import = true;
    if (text.includes('upload')) actions.upload = true;
    if (text.includes('download')) actions.download = true;
    
    return actions;
  }

  isEdenTicket(ticket) {
    const summary = (ticket.summary || '').toLowerCase();
    const description = (ticket.description || '').toLowerCase();
    
    // Check if title contains 'eden' or description mentions Eden-specific patterns
    return summary.includes('eden') || 
           description.includes('eden') || 
           description.includes('ui://') || 
           description.includes('{{ui://') ||
           description.includes('confluence.paramount.tech');
  }

  generateEdenTestCases(ticket, options = {}) {
    const { style = 'BDD' } = options;
    const testCases = [];
    
    if (ticket.type?.toLowerCase() === 'bug') {
      // Eden bug - focus on log validation
      const logEvents = this.extractEdenLogEvents(ticket.description);
      const uiReferences = this.extractEdenUIReferences(ticket.description);
      
      testCases.push({
        title: `Eden Bug Validation: ${ticket.summary}`,
        objective: `Validate Eden events and logs match expected patterns for ${ticket.summary}`,
        preconditions: 'Eden environment accessible, test user configured with appropriate subscription',
        priority: 'High',
        steps: [
          { action: 'Access Eden dashboard/admin panel', expected: 'Eden interface loads successfully' },
          { action: 'Navigate to the affected Eden feature/flow', expected: 'Feature is accessible' },
          { action: 'Perform the steps described in the ticket', expected: 'Actions execute without errors' },
          { action: 'Open developer console and network tab', expected: 'Console and network monitoring active' },
          { action: 'Trigger the Eden event/action', expected: 'Event fires and is captured in logs' },
          { action: 'Review Eden event logs', expected: 'Event structure matches expected format' },
          ...logEvents.map(event => ({
            action: `Verify log event: ${event}`,
            expected: `Event "${event}" is present in logs with correct data`
          })),
          { action: 'Compare actual vs expected event payloads', expected: 'Payloads match the documented structure' },
          { action: 'Validate UI state after event', expected: 'UI reflects the correct state based on event' }
        ],
        expectedResult: 'All Eden events fire correctly with expected payloads and UI updates appropriately',
        testData: {
          subscription: 'Essential Yearly',
          ...this.parseEdenTestData(uiReferences)
        },
        notes: uiReferences.length > 0 ? 
          `⚠️ Eden UI References found: ${uiReferences.join(', ')}. Manual verification required.` : 
          undefined
      });
      
      // Add regression test for Eden
      testCases.push({
        title: `Eden Regression Test: ${ticket.summary}`,
        objective: 'Ensure Eden fix doesn\'t break other subscription flows',
        preconditions: 'Multiple test accounts with different subscription types',
        priority: 'Medium',
        steps: [
          { action: 'Test with Essential Monthly subscription', expected: 'Flow works correctly' },
          { action: 'Test with Essential Yearly subscription', expected: 'Flow works correctly' },
          { action: 'Test with Premium Monthly subscription', expected: 'Flow works correctly' },
          { action: 'Test with Premium Yearly subscription', expected: 'Flow works correctly' },
          { action: 'Test upgrade flow', expected: 'Upgrade completes successfully' },
          { action: 'Test downgrade flow', expected: 'Downgrade completes successfully' },
          { action: 'Verify all Eden events fire correctly', expected: 'Events match expected patterns' }
        ],
        expectedResult: 'All subscription flows work correctly without regression'
      });
    } else {
      // Eden story - likely has Confluence references
      const confluenceRefs = this.extractConfluenceReferences(ticket.description);
      
      testCases.push({
        title: `Eden Feature Validation: ${ticket.summary}`,
        objective: `Validate Eden feature implementation according to specifications`,
        preconditions: 'Eden environment configured, test accounts with various subscription states',
        priority: 'High',
        steps: [
          { action: 'Review Eden feature requirements', expected: 'Requirements understood' },
          { action: 'Access Eden feature in test environment', expected: 'Feature is accessible' },
          { action: 'Test primary Eden flow', expected: 'Flow completes successfully' },
          { action: 'Verify Eden events fire correctly', expected: 'All events captured with correct data' },
          { action: 'Test with different subscription tiers', expected: 'Feature behaves correctly for each tier' },
          { action: 'Validate UI components render correctly', expected: 'All Eden UI elements display properly' },
          { action: 'Test error scenarios', expected: 'Errors handled gracefully' },
          { action: 'Verify analytics events', expected: 'Analytics capture correct Eden data' }
        ],
        expectedResult: 'Eden feature works as specified in requirements',
        notes: confluenceRefs.length > 0 ? 
          `⚠️ Confluence documentation references found but not accessible: ${confluenceRefs.join(', ')}. Please review documentation manually.` :
          '⚠️ Eden story - please review Confluence documentation for detailed requirements.'
      });
      
      // Add Eden-specific edge cases
      testCases.push({
        title: `Eden Edge Cases: ${ticket.summary}`,
        objective: 'Test Eden feature with various edge cases and subscription states',
        preconditions: 'Test accounts in various states (trial, expired, cancelled, etc.)',
        priority: 'Medium',
        steps: [
          { action: 'Test with trial account', expected: 'Appropriate trial limitations applied' },
          { action: 'Test with expired subscription', expected: 'Expiry handled correctly' },
          { action: 'Test with cancelled subscription', expected: 'Cancellation state reflected' },
          { action: 'Test during plan transition', expected: 'Transition handled smoothly' },
          { action: 'Test with payment failure state', expected: 'Payment issues handled gracefully' },
          { action: 'Test concurrent Eden events', expected: 'Events don\'t conflict' },
          { action: 'Test Eden feature in different locales', expected: 'Localization works correctly' }
        ],
        expectedResult: 'All edge cases handled appropriately'
      });
    }
    
    return { testCases, style };
  }

  extractEdenLogEvents(description) {
    const events = [];
    
    // Look for common Eden event patterns
    const eventPatterns = [
      /event[:\s]+([\w_]+)/gi,
      /"event"[:\s]+"([\w_]+)"/gi,
      /Eden\.track\(['"]([\w_]+)['"]/gi,
      /analytics\.track\(['"]([\w_]+)['"]/gi
    ];
    
    eventPatterns.forEach(pattern => {
      const matches = description.matchAll(pattern);
      for (const match of matches) {
        if (match[1]) events.push(match[1]);
      }
    });
    
    // Also look for specific Eden events mentioned in text
    const commonEdenEvents = [
      'subscription_started', 'subscription_cancelled', 'subscription_upgraded',
      'subscription_downgraded', 'payment_succeeded', 'payment_failed',
      'trial_started', 'trial_ended', 'plan_selected', 'billing_updated'
    ];
    
    commonEdenEvents.forEach(event => {
      if (description.includes(event)) {
        events.push(event);
      }
    });
    
    return [...new Set(events)]; // Remove duplicates
  }

  extractEdenUIReferences(description) {
    const refs = [];
    
    // Match Eden UI reference patterns
    const patterns = [
      /{{ui:\/\/[^}]+}}/g,
      /ui:\/\/[\w\-\/]+/g
    ];
    
    patterns.forEach(pattern => {
      const matches = description.match(pattern);
      if (matches) {
        refs.push(...matches);
      }
    });
    
    return refs;
  }

  extractConfluenceReferences(description) {
    const refs = [];
    
    // Match Confluence URLs
    const confluencePattern = /https?:\/\/confluence\.paramount\.tech[^\s]+/g;
    const matches = description.match(confluencePattern);
    
    if (matches) {
      refs.push(...matches);
    }
    
    return refs;
  }

  parseEdenTestData(uiReferences) {
    const testData = {};
    
    // Parse UI references to extract test data hints
    uiReferences.forEach(ref => {
      if (ref.includes('payment-option')) {
        if (ref.includes('annual')) testData.billingPeriod = 'annual';
        if (ref.includes('monthly')) testData.billingPeriod = 'monthly';
        if (ref.includes('essential')) testData.planTier = 'essential';
        if (ref.includes('premium')) testData.planTier = 'premium';
      }
    });
    
    // Add default Eden test data
    testData.testEmail = 'eden.test@paramount.com';
    testData.testCard = '4111111111111111';
    testData.zipCode = '10001';
    
    return testData;
  }

  generateTestsFromConfluenceScenarios(ticket, options = {}) {
    const { style = 'BDD' } = options;
    const testCases = [];
    
    logger.info(`Generating test cases from ${ticket.confluenceScenarios.length} Confluence scenarios`);
    
    // Generate test cases from Confluence scenarios
    ticket.confluenceScenarios.forEach((scenario, index) => {
      const steps = this.convertScenarioToDetailedSteps(scenario, ticket);
      
      testCases.push({
        title: `Confluence Test ${index + 1}: ${this.summarizeScenario(scenario)}`,
        objective: `Validate documented scenario: ${scenario}`,
        preconditions: this.extractPreconditions(ticket),
        priority: index < 3 ? 'High' : 'Medium', // First 3 are high priority
        steps: steps,
        expectedResult: `Scenario completes as documented in Confluence`,
        testData: this.generateTestData(ticket),
        source: 'Confluence Documentation'
      });
    });
    
    // Add technical spec validation if available
    if (ticket.technicalSpecs) {
      if (ticket.technicalSpecs.endpoints?.length > 0) {
        testCases.push({
          title: 'API Endpoint Validation',
          objective: 'Verify all documented API endpoints work correctly',
          preconditions: 'API access configured, test data prepared',
          priority: 'High',
          steps: ticket.technicalSpecs.endpoints.map(ep => ({
            action: `Test ${ep.method} ${ep.path}`,
            expected: 'Endpoint responds with correct status and data structure'
          })),
          expectedResult: 'All API endpoints function as documented'
        });
      }
      
      if (ticket.technicalSpecs.uiElements?.length > 0) {
        testCases.push({
          title: 'UI Element Validation',
          objective: 'Verify all documented UI elements are present and functional',
          preconditions: 'Application UI accessible',
          priority: 'Medium',
          steps: ticket.technicalSpecs.uiElements.map(element => ({
            action: `Locate and interact with "${element}"`,
            expected: `"${element}" is visible and responds to interaction`
          })),
          expectedResult: 'All UI elements match documentation'
        });
      }
    }
    
    // Add standard edge cases
    testCases.push({
      title: `Edge Cases: ${ticket.summary}`,
      objective: 'Test boundary conditions beyond documented scenarios',
      preconditions: this.extractPreconditions(ticket),
      priority: 'Low',
      steps: this.generateEdgeCaseSteps(ticket),
      expectedResult: 'System handles edge cases gracefully'
    });
    
    return { testCases, style };
  }

  convertScenarioToDetailedSteps(scenario, ticket) {
    const steps = [];
    const scenarioLower = scenario.toLowerCase();
    
    // Handle Given/When/Then format
    if (scenarioLower.includes('given') || scenarioLower.includes('when') || scenarioLower.includes('then')) {
      const gwtParts = scenario.split(/(?=given|when|then)/i);
      gwtParts.forEach(part => {
        const trimmed = part.trim();
        if (trimmed) {
          if (trimmed.toLowerCase().startsWith('given')) {
            steps.push({
              action: `Setup: ${trimmed.substring(5).trim()}`,
              expected: 'Precondition established'
            });
          } else if (trimmed.toLowerCase().startsWith('when')) {
            steps.push({
              action: trimmed.substring(4).trim(),
              expected: 'Action performed successfully'
            });
          } else if (trimmed.toLowerCase().startsWith('then')) {
            steps.push({
              action: 'Verify result',
              expected: trimmed.substring(4).trim()
            });
          }
        }
      });
    } else {
      // Parse as regular scenario
      const parsed = this.convertScenarioToSteps(scenario, ticket);
      steps.push(...parsed);
    }
    
    return steps.length > 0 ? steps : [{
      action: `Execute: ${scenario}`,
      expected: 'Scenario completes as documented'
    }];
  }

  extractEntities(text) {
    const entities = [];
    
    // Common entities in software
    const commonEntities = [
      'user', 'profile', 'account', 'customer', 'client',
      'product', 'item', 'order', 'invoice', 'payment',
      'document', 'file', 'report', 'message', 'notification',
      'task', 'ticket', 'issue', 'project', 'team',
      'role', 'permission', 'group', 'category', 'tag'
    ];
    
    commonEntities.forEach(entity => {
      if (text.includes(entity)) {
        entities.push(entity);
      }
    });
    
    // Also look for custom entities (capitalized words that might be entities)
    const capitalizedWords = text.match(/[A-Z][a-z]+/g);
    if (capitalizedWords) {
      entities.push(...capitalizedWords.filter(word => 
        !['The', 'This', 'That', 'When', 'Where', 'What', 'How'].includes(word)
      ));
    }
    
    return [...new Set(entities)]; // Remove duplicates
  }

  extractActionFromCriterion(criterion) {
    // Convert acceptance criterion to actionable step
    const lowerCriterion = criterion.toLowerCase();
    
    if (lowerCriterion.includes('user can')) {
      return criterion.replace(/user can/i, 'Verify that user can');
    }
    if (lowerCriterion.includes('system should')) {
      return criterion.replace(/system should/i, 'Verify that system');
    }
    if (lowerCriterion.includes('must')) {
      return `Verify that ${criterion}`;
    }
    
    return `Test: ${criterion}`;
  }

  generateValidationSteps(ticket) {
    const description = (ticket.description || '').toLowerCase();
    const steps = [];
    
    if (description.includes('email')) {
      steps.push(
        { action: 'Enter invalid email format', expected: 'Email validation error appears' },
        { action: 'Enter email without domain', expected: 'Invalid email error shown' }
      );
    }
    
    if (description.includes('password')) {
      steps.push(
        { action: 'Enter password below minimum length', expected: 'Password too short error' },
        { action: 'Enter password without required characters', expected: 'Password complexity error' }
      );
    }
    
    if (description.includes('date') || description.includes('time')) {
      steps.push(
        { action: 'Enter invalid date format', expected: 'Date format error appears' },
        { action: 'Enter date in the past (if not allowed)', expected: 'Invalid date range error' }
      );
    }
    
    // Always add generic validation
    steps.push(
      { action: 'Leave all required fields empty', expected: 'Required field errors appear' },
      { action: 'Enter data exceeding maximum length', expected: 'Maximum length error shown' },
      { action: 'Submit form with validation errors', expected: 'Form submission is prevented' },
      { action: 'Correct all validation errors', expected: 'Errors clear when fixed' }
    );
    
    return steps;
  }

  generateEdgeCaseSteps(ticket) {
    const description = (ticket.description || '').toLowerCase();
    const steps = [];
    
    // Add context-specific edge cases
    if (description.includes('upload') || description.includes('file')) {
      steps.push(
        { action: 'Upload file at maximum size limit', expected: 'File is accepted' },
        { action: 'Upload file slightly over limit', expected: 'File size error shown' },
        { action: 'Upload unsupported file type', expected: 'File type error shown' },
        { action: 'Upload multiple files simultaneously', expected: 'All files processed correctly' }
      );
    }
    
    if (description.includes('search')) {
      steps.push(
        { action: 'Search with special characters', expected: 'Search handles special chars correctly' },
        { action: 'Search with very long query', expected: 'Query is truncated appropriately' },
        { action: 'Search with no results', expected: 'No results message shown' },
        { action: 'Search with SQL injection attempt', expected: 'Input is sanitized safely' }
      );
    }
    
    // Generic edge cases
    steps.push(
      { action: 'Test with minimum valid values', expected: 'Minimum values accepted' },
      { action: 'Test with maximum valid values', expected: 'Maximum values handled' },
      { action: 'Test with unicode and emoji characters', expected: 'Special characters handled' },
      { action: 'Test rapid successive submissions', expected: 'Duplicate prevention works' },
      { action: 'Test browser back/forward navigation', expected: 'State maintained correctly' }
    );
    
    return steps;
  }

  generateTestData(ticket) {
    const description = (ticket.description || '').toLowerCase();
    const data = {};
    
    if (description.includes('email')) {
      data.validEmail = 'test.user@example.com';
      data.alternateEmail = 'alternate.user@test.org';
    }
    
    if (description.includes('password')) {
      data.validPassword = 'SecureP@ss123!';
      data.newPassword = 'NewSecure#456';
    }
    
    if (description.includes('phone')) {
      data.validPhone = '+1-555-123-4567';
      data.alternatePhone = '555-987-6543';
    }
    
    if (description.includes('name') || description.includes('user')) {
      data.firstName = 'Test';
      data.lastName = 'User';
      data.username = 'testuser123';
    }
    
    if (description.includes('date')) {
      data.validDate = new Date().toISOString().split('T')[0];
      data.futureDate = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    }
    
    // Add generic test data if nothing specific
    if (Object.keys(data).length === 0) {
      data.testInput = 'Test Value 123';
      data.description = 'Test description for QA testing';
      data.id = 'TEST-' + Date.now();
    }
    
    return data;
  }

  generateInvalidTestData(ticket) {
    const description = (ticket.description || '').toLowerCase();
    const data = {};
    
    if (description.includes('email')) {
      data.invalidEmail = 'not-an-email';
      data.malformedEmail = '@example.com';
      data.missingDomain = 'user@';
    }
    
    if (description.includes('password')) {
      data.shortPassword = '123';
      data.weakPassword = 'password';
      data.noSpecialChars = 'Password123';
    }
    
    if (description.includes('phone')) {
      data.invalidPhone = '123';
      data.tooLongPhone = '123456789012345678901';
    }
    
    if (description.includes('date')) {
      data.invalidDate = '2024-13-45';
      data.wrongFormat = '45/13/2024';
      data.textDate = 'yesterday';
    }
    
    // Generic invalid data
    data.emptyString = '';
    data.nullValue = null;
    data.tooLongText = 'x'.repeat(1000);
    data.sqlInjection = "'; DROP TABLE users; --";
    data.scriptInjection = '<script>alert("XSS")</script>';
    
    return data;
  }

  generateEdgeCaseData(ticket) {
    return {
      minValue: 0,
      maxValue: 2147483647, // Max 32-bit integer
      minLength: 'a',
      maxLength: 'x'.repeat(255),
      specialChars: '!@#$%^&*()_+-=[]{}|;:\'"<>,.?/',
      unicode: '测试数据 🎯🚀🎉',
      whitespace: '   test   ',
      lineBreaks: 'line1\nline2\rline3',
      htmlEntities: '&lt;&gt;&amp;&quot;',
      zeroValues: [0, 0.0, '0', false],
      boundaryDates: {
        minDate: '1900-01-01',
        maxDate: '2099-12-31',
        leapYear: '2024-02-29'
      }
    };
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
