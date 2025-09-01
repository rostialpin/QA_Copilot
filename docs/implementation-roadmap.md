# QA Copilot Implementation Roadmap

## Overview
Complete workflow from JIRA ticket selection to TestRail storage and Cypress generation.

## Current Architecture

```
User Flow:
1. Select JIRA Project → Load Sprint → Select Ticket
2. Select TestRail Folder → Load Context Tests → Train AI
3. Generate Test Cases → Review → Save to TestRail
4. (Optional) Generate Cypress → Download Code
```

## Detailed Task List

### Phase 1: Workflow Setup (Day 1)
- [ ] Create unified workflow controller
- [ ] Build step-by-step wizard UI
- [ ] Connect JIRA → TestRail flow
- [ ] Add progress tracking

### Phase 2: Data Processing (Day 1-2)
- [ ] JIRA field filtering service
  - Remove internal fields
  - Extract test-relevant data
  - Structure for AI consumption
- [ ] TestRail pattern extraction
  - Parse test case structure
  - Extract naming patterns
  - Identify common steps

### Phase 3: AI Training Integration (Day 2)
- [ ] Context builder service
  - Combine JIRA + TestRail data
  - Format training examples
  - Build prompts with patterns
- [ ] Pattern matching scorer
  - Compare generated vs existing
  - Quality metrics

### Phase 4: TestRail Integration (Day 2-3)
- [ ] Save to TestRail API
  - Create test cases
  - Set proper fields
  - Link to JIRA
- [ ] Folder selection UI
- [ ] Bulk operations support

### Phase 5: Cypress Enhancement (Day 3)
- [ ] Load real Cypress examples
  - From GitHub repo
  - Or local files
- [ ] Pattern extraction
  - Commands used
  - Selector patterns
  - Assertion styles
- [ ] Generate matching code

### Phase 6: Demo Preparation (Day 3-4)
- [ ] Create demo scenario
- [ ] Prepare sample ticket
- [ ] Load example tests
- [ ] Practice full flow

## Technical Implementation

### 1. Workflow Orchestrator Service
```javascript
class WorkflowOrchestrator {
  constructor() {
    this.steps = [
      'selectTicket',
      'selectContext', 
      'filterData',
      'trainOnContext',
      'generateTests',
      'reviewTests',
      'saveToTestRail',
      'generateCypress'
    ];
    this.currentStep = 0;
    this.workflowData = {};
  }

  async executeStep(stepName, data) {
    // Process each step
    // Store results in workflowData
    // Move to next step
  }
}
```

### 2. Field Filter Configuration
```javascript
const fieldFilter = {
  // Fields to include
  include: [
    'summary',
    'description', 
    'acceptanceCriteria',
    'type',
    'priority',
    'components',
    'labels'
  ],
  
  // Fields to exclude (sensitive/internal)
  exclude: [
    'customfield_*', // Internal custom fields
    'votes',
    'watches', 
    'worklog',
    'comment.author',
    'attachment.content'
  ],
  
  // Transform fields
  transform: {
    description: (value) => {
      // Remove mentions, links to internal tools
      return value.replace(/@\w+/g, '[user]')
                 .replace(/https:\/\/internal\./g, '[internal-link]');
    }
  }
};
```

### 3. TestRail Context Analyzer
```javascript
class TestRailContextAnalyzer {
  analyzeTestCases(testCases) {
    return {
      patterns: {
        naming: this.extractNamingPattern(testCases),
        steps: this.extractStepPatterns(testCases),
        assertions: this.extractAssertionPatterns(testCases)
      },
      statistics: {
        avgSteps: this.calculateAvgSteps(testCases),
        commonPhrases: this.findCommonPhrases(testCases),
        priorities: this.analyzePriorities(testCases)
      },
      examples: this.selectBestExamples(testCases, 3)
    };
  }
}
```

### 4. Cypress Pattern Loader
```javascript
class CypressPatternLoader {
  async loadFromGitHub() {
    const patterns = await this.fetchTestFiles([
      'cypress/e2e/video-player/playback.cy.js',
      'cypress/e2e/navigation/browse.cy.js'
    ]);
    
    return this.extractPatterns(patterns);
  }
  
  extractPatterns(testFiles) {
    return {
      structure: this.analyzeStructure(testFiles),
      commands: this.extractCustomCommands(testFiles),
      selectors: this.extractSelectors(testFiles),
      assertions: this.extractAssertions(testFiles)
    };
  }
}
```

## UI Components Needed

### 1. Workflow Wizard Component
```jsx
<WorkflowWizard>
  <Step1_TicketSelection />
  <Step2_ContextSelection />
  <Step3_DataReview />
  <Step4_TestGeneration />
  <Step5_SaveOptions />
  <Step6_CypressGeneration />
</WorkflowWizard>
```

### 2. Field Filter UI
```jsx
<FieldFilterConfig>
  <IncludedFields />
  <ExcludedFields />
  <SensitiveDataMasking />
  <PreviewFilteredData />
</FieldFilterConfig>
```

### 3. Context Training UI
```jsx
<ContextTrainer>
  <TestRailExamples />
  <PatternSummary />
  <TrainingProgress />
  <QualityMetrics />
</ContextTrainer>
```

## API Endpoints Needed

### Backend Routes
```javascript
// Workflow
POST /api/workflow/start
POST /api/workflow/step
GET  /api/workflow/status

// Data Processing  
POST /api/filter/jira-fields
POST /api/analyze/testrail-context
POST /api/patterns/cypress

// TestRail Operations
POST /api/testrail/create-test
POST /api/testrail/bulk-create
PUT  /api/testrail/update-test

// Training & Generation
POST /api/train/context
POST /api/generate/with-context
GET  /api/quality/score
```

## Demo Scenario

### Sample JIRA Ticket
```
Key: ESWCTV-1234
Summary: Add Skip Intro button for video player
Type: Story
Description: 
  As a user, I want to skip intro sequences in videos
  so that I can get to the main content faster.
  
Acceptance Criteria:
  - Button appears 5 seconds into intro
  - Button disappears after intro ends
  - Works on both Roku and CTV platforms
```

### Expected TestRail Output
```
Test Case: Skip Intro - Button Display Timing
Preconditions: User is logged in, video with intro is available
Steps:
  1. Navigate to video with intro
  2. Start video playback
  3. Wait for 5 seconds
  4. Verify Skip Intro button appears
  5. Click Skip Intro
  6. Verify video jumps to main content
Expected: Skip functionality works correctly
```

### Expected Cypress Output
```javascript
describe('Video Player - Skip Intro', () => {
  beforeEach(() => {
    cy.login();
    cy.visit('/video/test-intro-video');
  });

  it('should display skip intro button at correct time', () => {
    cy.get('[data-testid="video-player"]').click();
    cy.wait(5000);
    cy.get('[data-testid="skip-intro-button"]')
      .should('be.visible');
    cy.get('[data-testid="skip-intro-button"]').click();
    cy.get('[data-testid="video-timeline"]')
      .should('have.attr', 'data-time')
      .and('be.greaterThan', '30');
  });
});
```

## Success Metrics

1. **Workflow Completion Rate**: User can complete full flow
2. **Pattern Matching Score**: >80% similarity to existing tests  
3. **Generation Speed**: <5 seconds per test case
4. **TestRail Save Success**: 100% successful saves
5. **Cypress Code Quality**: Runs without modification

## Timeline

- **Day 1**: Workflow setup, field filtering
- **Day 2**: Context training, test generation
- **Day 3**: TestRail save, Cypress generation
- **Day 4**: Testing, demo preparation
- **Hackathon Day**: Live demonstration

## Notes

- Keep UI simple and intuitive
- Focus on happy path for demo
- Cache everything for speed
- Have fallback/mock data ready
- Practice demo flow multiple times